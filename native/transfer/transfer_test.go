// Run by both build scripts before they bind, WITH the overlay the binding is built with
// (`go test -overlay "$(./overlay.sh <dir>)" .`), so an archive is never produced from a tree whose
// relay handling was not checked.

package obalkatransfer

import (
	"context"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/schollz/croc/v10/src/comm"
	"github.com/schollz/croc/v10/src/croc"
	"github.com/schollz/croc/v10/src/models"
)

// The patch in `patches/` is in effect: loading croc resolved nothing. Without it croc's `init`
// turns these into `ip:9009` - or into "" on a machine that is offline - before any test runs.
func TestRelaysAreNotResolvedWhileTheLibraryLoads(t *testing.T) {
	if models.DEFAULT_RELAY != "croc.schollz.com" || models.DEFAULT_RELAY6 != "croc6.schollz.com" {
		t.Fatalf("croc resolved its relays at load (%q, %q): build with the overlay from overlay.sh",
			models.DEFAULT_RELAY, models.DEFAULT_RELAY6)
	}
}

// The names the app puts on screen (`TRANSFER_RELAY` in src/services/transfer/transport.ts) are the
// names this hands croc.
func TestOptionsNameCrocsOwnRelays(t *testing.T) {
	o := options("secret", false, true)
	if o.RelayAddress != "croc.schollz.com:9009" {
		t.Errorf("RelayAddress = %q", o.RelayAddress)
	}
	if o.RelayAddress6 != "croc6.schollz.com:9009" {
		t.Errorf("RelayAddress6 = %q", o.RelayAddress6)
	}
	if len(o.RelayPorts) == 0 {
		t.Error("RelayPorts is empty; croc panics in setupLocalRelay without it (T001)")
	}
}

func TestRelayAddressKeepsAPortItAlreadyHas(t *testing.T) {
	cases := map[string]string{
		"":                   "",
		"croc.schollz.com":   "croc.schollz.com:9009",
		"203.0.113.7:9009":   "203.0.113.7:9009",
		"[2001:db8::1]:9009": "[2001:db8::1]:9009",
	}
	for in, want := range cases {
		if got := relayAddress(in); got != want {
			t.Errorf("relayAddress(%q) = %q, want %q", in, got, want)
		}
	}
}

// A relay reached by name is the relay; only a private address means the bytes stayed local.
func TestIsPrivateAddr(t *testing.T) {
	cases := map[string]bool{
		"192.168.1.20:9009":     true,
		"10.0.0.2:33208":        true,
		"[fe80::1]:9009":        true,
		"127.0.0.1:9009":        true,
		"croc.schollz.com:9009": false,
		"203.0.113.7:9009":      false,
	}
	for in, want := range cases {
		if got := isPrivateAddr(in); got != want {
			t.Errorf("isPrivateAddr(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestClassifyTellsARefusedPhraseApart(t *testing.T) {
	if !errors.Is(classify(errors.New("could not secure channel")), ErrPhraseRefused) {
		t.Error("a failed PAKE must read as a refused phrase")
	}
	if errors.Is(classify(errors.New("connection refused")), ErrPhraseRefused) {
		t.Error("a network failure must not read as a refused phrase")
	}
	if classify(nil) != nil {
		t.Error("no error must stay no error")
	}
}

// A wrong phrase as the SENDER sees it: the receiver's first sealed message does not open.
func TestClassifyReadsTheSendersSideOfAWrongPhrase(t *testing.T) {
	if !errors.Is(classify(errors.New("cipher: message authentication failed")), ErrPhraseRefused) {
		t.Error("the sender's failed decrypt must read as a refused phrase, not a broken transfer")
	}
}

// croc prints the phrase itself for a person at a terminal; on Android that went to the system log.
func TestCrocIsToldToStayQuiet(t *testing.T) {
	if !options("secret", false, true).Quiet || !options("secret", false, false).Quiet {
		t.Error("croc must run Quiet, or it prints the phrase where the system log keeps it")
	}
}

// The patch in `patches/` is in effect: a connection croc wraps reaches the run that is current.
func TestEveryConnectionCrocOpensIsTracked(t *testing.T) {
	run := track()
	defer run.release()
	ours, theirs := net.Pipe()
	defer theirs.Close()
	comm.New(ours)
	run.closeAll()
	if _, err := ours.Read(make([]byte, 1)); err == nil {
		t.Fatal("closing the run did not close the connection croc opened: build with prepare.sh")
	}
}

func TestAConnectionOpenedAfterTheRunEndedIsClosed(t *testing.T) {
	run := track()
	run.release()
	ours, theirs := net.Pipe()
	defer theirs.Close()
	comm.New(ours)
	if _, err := ours.Read(make([]byte, 1)); err == nil {
		t.Fatal("a connection nobody will ever close was left open")
	}
}

// blockedRead stands in for croc waiting at the relay: a read on a connection croc opened, which
// nothing but closing that connection ends.
func blockedRead() error {
	ours, theirs := net.Pipe()
	defer theirs.Close()
	_, err := comm.New(ours).Receive()
	return err
}

func TestAStopEndsACallBlockedAtTheRelay(t *testing.T) {
	run := track()
	defer run.release()
	ctx, cancel := context.WithCancel(context.Background())
	go func() { time.Sleep(50 * time.Millisecond); cancel() }()
	start := time.Now()
	err := supervise(ctx, run, &croc.Client{}, time.Hour, ErrNoAnswer, blockedRead)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want the stop", err)
	}
	if time.Since(start) > time.Second {
		t.Fatalf("the stop took %v to reach a blocked read", time.Since(start))
	}
}

func TestNoHandshakeWithinTheLimitEndsTheRun(t *testing.T) {
	run := track()
	defer run.release()
	err := supervise(context.Background(), run, &croc.Client{}, 200*time.Millisecond, ErrNoAnswer, blockedRead)
	if !errors.Is(err, ErrNoAnswer) {
		t.Fatalf("err = %v, want ErrNoAnswer", err)
	}
}

func TestACompletedHandshakeIsNotTimedOut(t *testing.T) {
	run := track()
	defer run.release()
	client := &croc.Client{Step1ChannelSecured: true}
	err := supervise(context.Background(), run, client, 50*time.Millisecond, ErrNoAnswer, func() error {
		time.Sleep(300 * time.Millisecond)
		return nil
	})
	if err != nil {
		t.Fatalf("err = %v: a transfer under way must not hit the handshake limit", err)
	}
}

// A call that ignores its closed connections cannot hold the host's one transfer thread.
func TestACallThatWillNotEndIsLeftBehind(t *testing.T) {
	saved := windDown
	windDown = 100 * time.Millisecond
	defer func() { windDown = saved }()
	run := track()
	defer run.release()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	never := make(chan struct{})
	defer close(never)
	start := time.Now()
	err := supervise(ctx, run, &croc.Client{}, time.Hour, ErrNoAnswer, func() error {
		<-never
		return nil
	})
	if !errors.Is(err, context.Canceled) || time.Since(start) > time.Second {
		t.Fatalf("err = %v after %v, want the stop within the wind-down", err, time.Since(start))
	}
}

type routeSeen struct{ relayed []bool }

func (r *routeSeen) Step(string, int64, int64) {}
func (r *routeSeen) Relayed(via bool)           { r.relayed = append(r.relayed, via) }

// A transfer done inside one polling tick still says which way it went (025 T027).
func TestARouteSettledJustBeforeTheEndIsReported(t *testing.T) {
	client := &croc.Client{}
	seen := &routeSeen{}
	stop := watchRoute(client, false, true, seen)
	client.ExternalIPConnected = "203.0.113.7:51234"
	stop()
	stop()
	if len(seen.relayed) != 1 || !seen.relayed[0] {
		t.Fatalf("relayed = %v, want exactly one report of the relay", seen.relayed)
	}
}

func TestARouteNeverSettledIsNotReported(t *testing.T) {
	seen := &routeSeen{}
	watchRoute(&croc.Client{}, false, false, seen)()
	if len(seen.relayed) != 0 {
		t.Fatalf("relayed = %v, want nothing: the route was never known", seen.relayed)
	}
}

func TestTheRouteIsReadFromWhereThisSideConnected(t *testing.T) {
	cases := []struct {
		name      string
		isSender  bool
		dialled   string
		connected string
		relayed   bool
	}{
		// The sender sees the receiver as the relay saw it.
		{"sender, receiver on the LAN", true, "", "192.168.1.20:50112", false},
		{"sender, receiver over the relay", true, "", "203.0.113.7:51234", true},
		// The walk's case: the sender reported its own loopback join; the bytes crossed the relay.
		{"receiver through the relay", false, "croc.schollz.com:9009", "127.0.0.1:49200", true},
		{"receiver that found the sender locally", false, "192.168.1.30:9009", "192.168.1.30:9009", false},
	}
	for _, tc := range cases {
		c := &croc.Client{ExternalIPConnected: tc.connected}
		c.Options.RelayAddress = tc.dialled
		if got := routeRelayed(c, tc.isSender); got != tc.relayed {
			t.Errorf("%s: relayed = %v, want %v", tc.name, got, tc.relayed)
		}
	}
}
