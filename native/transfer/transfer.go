// The whole native surface of the phone-to-phone transfer (025 T009).
//
// This package exists to be as small as it possibly can be, because everything it can reach is
// something the rest of the app cannot check. Its entire vocabulary is "this directory, under this
// phrase": it takes a PATH to bytes that something above it has already sealed, and it has no way to
// be handed a snapshot, a passphrase or an archive. That is how FR-001 is enforced rather than
// promised — not by a rule somebody has to remember, but by there being no call that could break it.
//
// gomobile binds a restricted subset of Go: exported functions over strings, ints, bools, []byte and
// errors, plus interfaces implemented on the host side for callbacks. So the shape below is not a
// style choice, it is the whole of what can cross. Anything richer belongs in TypeScript.
//
// WHY THE DEFAULTS ARE WRITTEN OUT. croc's library API is CLI-first and assumes the command line
// filled its Options in. Leaving RelayPorts nil does not fail validation, it panics inside
// setupLocalRelay with "index out of range [0]" — a nil slice indexed at zero. Spelling the defaults
// here means a croc upgrade that changes them is a diff in this file rather than a silent change in
// where somebody's government mail goes.

package obalkatransfer

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/schollz/croc/v10/src/croc"
	"github.com/schollz/croc/v10/src/models"
)

// Progress is implemented on the host side (Kotlin / Swift) and called from Go.
//
// Relayed reports what actually happened rather than what was asked for. croc is "p2p with relay
// fallback", and the spike caught it rendezvousing through a relay and then moving the bytes
// directly — so "did my mail cross a relay" is an observation, never an echo of the flag.
type Progress interface {
	Step(stage string, sent int64, total int64)
	Relayed(via bool)
}

// Canceller is the host's cooperative stop flag, checked between steps.
//
// An interface rather than a bool because gomobile cannot pass a pointer the host keeps writing to;
// the host implements this and Go asks.
type Canceller interface {
	Cancelled() bool
}

// ErrPhraseRefused is returned when the handshake failed in the way a wrong phrase fails.
//
// Told apart from a transport failure on purpose: PAKE gives exactly one guess per attempt, so a
// person WILL hit this, and "check the phrase" and "check the network" are different remedies.
var ErrPhraseRefused = errors.New("phrase refused")

// relayAddress is one of croc's relay host names with its port, resolved only when a transfer
// connects to it (025 T022).
//
// croc itself resolves both relays in an `init` - that is, when the library is LOADED. On Android
// that is the first transfer; on iOS the Go runtime starts with the process, so it was every app
// launch, a DNS question about the relay with nobody transferring anything, and a phone launched
// offline kept an empty relay address until the app was restarted. The builds patch that lookup
// out (`patches/`, applied by `overlay.sh`), which leaves DEFAULT_RELAY and DEFAULT_RELAY6 as the
// bare names this adds the port to. A build without the patch still works: it hands over the
// resolved `ip:port` croc produced, unchanged.
func relayAddress(host string) string {
	if host == "" {
		return ""
	}
	if _, _, err := net.SplitHostPort(host); err == nil {
		return host
	}
	return net.JoinHostPort(host, models.DEFAULT_PORT)
}

// The relay ports croc's own CLI defaults to. Written out; see the file header.
func relayPorts() []string {
	return []string{"9009", "9010", "9011", "9012", "9013"}
}

func options(secret string, onlyLocal bool, isSender bool) croc.Options {
	return croc.Options{
		IsSender:      isSender,
		SharedSecret:  secret,
		RelayAddress:  relayAddress(models.DEFAULT_RELAY),
		RelayAddress6: relayAddress(models.DEFAULT_RELAY6),
		RelayPorts:    relayPorts(),
		RelayPassword: models.DEFAULT_PASSPHRASE,
		// OnlyLocal is a supported mode, which is what lets "nothing left this network" be a property
		// of the configuration instead of something inferred from a packet capture afterwards.
		OnlyLocal:    onlyLocal,
		DisableLocal: false,
		NoPrompt:     true,
		// The payload is already sealed, so it is incompressible: compressing ciphertext spends CPU
		// on a phone to make the file very slightly bigger.
		NoCompress:    true,
		Overwrite:     true,
		Curve:         "p256",
		HashAlgorithm: "xxhash",
		Debug:         false,
	}
}

// watch turns the host's cooperative flag into a context the croc client honours.
//
// Returns the context and a stop function the caller must always call, or the polling goroutine
// outlives the transfer.
func watch(c Canceller) (context.Context, func()) {
	ctx, cancel := context.WithCancel(context.Background())
	if c == nil {
		return ctx, cancel
	}
	var once sync.Once
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-done:
				return
			case <-ctx.Done():
				return
			default:
			}
			if c.Cancelled() {
				cancel()
				return
			}
			// Between steps, not inside one. 100 ms is far below what a person notices and far above
			// what would make this a busy loop.
			sleep100ms()
		}
	}()
	return ctx, func() {
		once.Do(func() { close(done) })
		cancel()
	}
}

// Send offers every file in dir. Blocks until the far side has taken them, or fails.
func Send(dir string, secret string, onlyLocal bool, p Progress, c Canceller) error {
	ctx, stop := watch(c)
	defer stop()

	client, err := croc.NewCtx(ctx, options(secret, onlyLocal, true))
	if err != nil {
		return classify(err)
	}
	if p != nil {
		p.Step("connecting", 0, 0)
	}
	// OnlyLocal is a guarantee, so it can be stated up front. Everything else has to be watched for:
	// the device run reported "relayed" from the flag while the bytes were going straight to
	// 10.0.0.2, which is exactly the claim FR-007 exists to prevent.
	stopRoute := watchRoute(client, onlyLocal, p)
	defer stopRoute()
	// The CONTENTS of dir, never dir itself. Handing croc a directory makes the receiver recreate
	// it - the device run put the bundle at `<in>/out/backup.obalka` instead of `<in>/backup.obalka`,
	// where the controller looks. Sending the files flat is what makes the two sides agree.
	paths, err := filesIn(dir)
	if err != nil {
		return fmt.Errorf("transfer: %w", err)
	}
	files, emptyFolders, totalFolders, err := croc.GetFilesInfo(paths, false, false, []string{})
	if err != nil {
		return fmt.Errorf("transfer: %w", err)
	}
	if err := client.Send(files, emptyFolders, totalFolders); err != nil {
		return classify(err)
	}
	if p != nil {
		p.Step("finishing", client.TotalSent, client.TotalSent)
	}
	return nil
}

// Receive pulls a transfer into dir. Blocks until it is complete, or fails.
func Receive(dir string, secret string, onlyLocal bool, p Progress, c Canceller) error {
	ctx, stop := watch(c)
	defer stop()

	if err := chdir(dir); err != nil {
		return fmt.Errorf("transfer: %w", err)
	}
	client, err := croc.NewCtx(ctx, options(secret, onlyLocal, false))
	if err != nil {
		return classify(err)
	}
	if p != nil {
		p.Step("connecting", 0, 0)
	}
	stopRoute := watchRoute(client, onlyLocal, p)
	defer stopRoute()
	if err := client.Receive(); err != nil {
		return classify(err)
	}
	if p != nil {
		p.Step("finishing", client.TotalSent, client.TotalSent)
	}
	return nil
}

// watchRoute reports whether the bytes are crossing a relay, once that is actually known.
//
// `ExternalIPConnected` is the address croc settled on: a private one means the peer was reached
// directly, and anything else means the relay. Until it is set, the honest answer is "not known
// yet", which is why the value the app carries is `boolean | null` rather than a boolean.
func watchRoute(c *croc.Client, onlyLocal bool, p Progress) func() {
	if p == nil {
		return func() {}
	}
	if onlyLocal {
		// A guarantee rather than an observation: this mode refuses anything but the local network.
		p.Relayed(false)
		return func() {}
	}
	done := make(chan struct{})
	var once sync.Once
	go func() {
		for {
			select {
			case <-done:
				return
			default:
			}
			if addr := c.ExternalIPConnected; addr != "" {
				p.Relayed(!isPrivateAddr(addr))
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
	}()
	return func() { once.Do(func() { close(done) }) }
}

// isPrivateAddr answers whether an address is on a local network.
//
// croc is "p2p with relay fallback" where the p2p half is the local network, so a private address
// means the bytes never left it. A hostname that is not an IP at all is the public relay.
func isPrivateAddr(addr string) bool {
	host := addr
	if h, _, err := net.SplitHostPort(addr); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()
}

// filesIn lists the regular files directly inside dir.
func filesIn(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	if len(out) == 0 {
		return nil, errors.New("nothing to send")
	}
	return out, nil
}

// classify tells a refused phrase apart from everything else.
//
// Matched on the message because croc returns plain errors here; if a future croc gives these
// types, this is the one function that changes.
func classify(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	for _, s := range []string{"could not secure channel", "bad password", "incorrect password", "pake"} {
		if strings.Contains(msg, s) {
			return ErrPhraseRefused
		}
	}
	return err
}
