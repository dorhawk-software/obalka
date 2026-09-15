// Run by both build scripts before they bind, WITH the overlay the binding is built with
// (`go test -overlay "$(./overlay.sh <dir>)" .`), so an archive is never produced from a tree whose
// relay handling was not checked.

package obalkatransfer

import (
	"errors"
	"testing"

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
