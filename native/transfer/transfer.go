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

	"github.com/schollz/croc/v10/src/comm"
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

// ErrNoAnswer is returned to a receiver that no sender answered in time (025 T027).
//
// A receiver joins the relay room named by the phrase's first four characters and waits there. Nobody
// in the room - the other phone stopped offering, or the phrase starts differently - and a phrase that
// matches the room but not the rest look the same from here: the sender refuses the handshake and
// says so on its own screen, and this side simply hears nothing back. Before this limit existed the
// receiver waited at the relay for hours.
var ErrNoAnswer = errors.New("no answer")

// ErrOfferExpired is returned to a sender nobody took the offer from in time.
//
// An offer keeps the display on (FR-014), so one left alone on a desk would otherwise keep the phone
// lit, and a connection at the relay, until the battery ran out.
var ErrOfferExpired = errors.New("offer expired")

// How long each side waits for the handshake to complete. A receiver is only started once somebody
// has typed the phrase the sender is showing, so the sender is already there: the handshake takes
// a second or two even over mobile data, and half a minute without one means it is not coming. A
// sender waits for a person to find the other phone and type four words.
const (
	answerLimit = 30 * time.Second
	offerLimit  = 10 * time.Minute
)

// How long a stopped run is given to wind down once its connections are closed. croc returns within
// milliseconds of losing them; the bound is there so a croc that does not cannot hold the thread
// every later transfer runs on. A variable only so the tests need not wait it out.
var windDown = 3 * time.Second

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
		// croc is a command line tool first and prints for a person at a terminal: the phrase
		// itself ("Code is: ...", and the command to type on the other computer) and progress bars.
		// On Android that output lands in the system log, where the phrase - the only secret of the
		// transfer - could be read back with a bug report (found on the 025 T027 walk).
		Quiet: true,
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

	conns := track()
	defer conns.release()
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
	stopRoute := watchRoute(client, onlyLocal, true, p)
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
	err = supervise(ctx, conns, client, offerLimit, ErrOfferExpired, func() error {
		return client.Send(files, emptyFolders, totalFolders)
	})
	if err != nil {
		return err
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
	conns := track()
	defer conns.release()
	client, err := croc.NewCtx(ctx, options(secret, onlyLocal, false))
	if err != nil {
		return classify(err)
	}
	if p != nil {
		p.Step("connecting", 0, 0)
	}
	stopRoute := watchRoute(client, onlyLocal, false, p)
	defer stopRoute()
	err = supervise(ctx, conns, client, answerLimit, ErrNoAnswer, client.Receive)
	if err != nil {
		return err
	}
	if p != nil {
		p.Step("finishing", client.TotalSent, client.TotalSent)
	}
	return nil
}

// supervise runs one croc call and makes sure it ends: when the host stops the run, and when the
// handshake has not completed within limit (then the result is onLimit).
//
// Both end the same way: every connection croc opened for this run is closed, which wakes whatever
// read it is blocked in. Then it gets windDown to return; if it has not, the call is left behind and
// this returns anyway, so the host's transfer thread is free for the next run. Once the handshake is
// done there is no limit: a whole archive over mobile data takes as long as it takes, and the person
// watching it can stop it.
func supervise(ctx context.Context, conns *tracked, client *croc.Client, limit time.Duration, onLimit error, call func() error) error {
	done := make(chan error, 1)
	go func() { done <- call() }()
	start := time.Now()
	tick := time.NewTicker(100 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case err := <-done:
			return classify(err)
		case <-ctx.Done():
			conns.closeAll()
			windDownOrLeave(done)
			return ctx.Err()
		case <-tick.C:
			// Read without a lock, as watchRoute reads ExternalIPConnected: croc writes it once, from
			// false to true, right after the field watchRoute waits for.
			if !client.Step1ChannelSecured && time.Since(start) > limit {
				conns.closeAll()
				windDownOrLeave(done)
				return onLimit
			}
		}
	}
}

func windDownOrLeave(done <-chan error) {
	select {
	case <-done:
	case <-time.After(windDown):
	}
}

// tracked holds the connections croc opened during one run (patches/croc-v10.7.0-close-on-stop.patch).
//
// The host runs one transfer at a time, so one run is current at a time; a connection croc opens for
// a run that has already been released - a call left behind by windDownOrLeave - is closed on the spot.
type tracked struct {
	mu     sync.Mutex
	conns  []net.Conn
	closed bool
}

var (
	currentMu sync.Mutex
	current   *tracked
)

func init() {
	comm.Opened = func(c net.Conn) {
		currentMu.Lock()
		t := current
		currentMu.Unlock()
		if t == nil {
			// Nothing is running, so nothing will ever close this.
			_ = c.Close()
			return
		}
		t.add(c)
	}
}

func track() *tracked {
	t := &tracked{}
	currentMu.Lock()
	current = t
	currentMu.Unlock()
	return t
}

func (t *tracked) add(c net.Conn) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.closed {
		_ = c.Close()
		return
	}
	t.conns = append(t.conns, c)
}

func (t *tracked) closeAll() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.closed = true
	for _, c := range t.conns {
		_ = c.Close()
	}
	t.conns = nil
}

// release ends the run: anything still open is closed, and the run stops being current.
func (t *tracked) release() {
	t.closeAll()
	currentMu.Lock()
	if current == t {
		current = nil
	}
	currentMu.Unlock()
}

// watchRoute reports whether the bytes are crossing a relay, once that is actually known.
//
// Known once `ExternalIPConnected` is set - croc sets it at the handshake, or earlier on a receiver
// that found the sender on the local network. Until then the honest answer is "not known yet",
// which is why the value the app carries is `boolean | null` rather than a boolean.
func watchRoute(c *croc.Client, onlyLocal, isSender bool, p Progress) func() {
	if p == nil {
		return func() {}
	}
	if onlyLocal {
		// A guarantee rather than an observation: this mode refuses anything but the local network.
		p.Relayed(false)
		return func() {}
	}
	done := make(chan struct{})
	var once, reported sync.Once
	check := func() bool {
		if c.ExternalIPConnected == "" {
			return false
		}
		relayed := routeRelayed(c, isSender)
		reported.Do(func() { p.Relayed(relayed) })
		return true
	}
	go func() {
		for {
			select {
			case <-done:
				return
			default:
			}
			if check() {
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
	}()
	// One last look on the way out. A small archive over a fast link is done inside one tick, and
	// the walk's receiver said "working out the route" under what had already arrived (025 T027).
	return func() {
		once.Do(func() {
			close(done)
			check()
		})
	}
}

// routeRelayed reads the route from the address this side actually connected through.
//
// A sender is told the receiver's address as the relay it joined saw it: a private one means the
// receiver came in over the local network, anything else crossed the relay. A receiver is NOT
// told anything it can use the same way: what arrives is the sender's own report, and a sender
// joins its own local relay at 127.0.0.1 half a second into every offer and reports that - so every
// receive read "direct", through the relay too (025 T027). The receiver's own answer is where it
// dialled: the sender's local-network address when discovery found it, the public relay otherwise.
func routeRelayed(c *croc.Client, isSender bool) bool {
	if isSender {
		return !isPrivateAddr(c.ExternalIPConnected)
	}
	return !isPrivateAddr(c.Options.RelayAddress)
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
	// "message authentication failed" is the SENDER's side of a wrong phrase: the receiver's first
	// message is sealed with a key derived from what was typed, and it does not open (025 T027).
	for _, s := range []string{"could not secure channel", "bad password", "incorrect password", "pake", "message authentication failed"} {
		if strings.Contains(msg, s) {
			return ErrPhraseRefused
		}
	}
	return err
}
