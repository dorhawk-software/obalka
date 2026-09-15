// The two bits of standard library the bound surface needs, kept out of transfer.go so that file
// stays a description of the transfer rather than of Go.

package obalkatransfer

import (
	"os"
	"time"
)

func sleep100ms() { time.Sleep(100 * time.Millisecond) }

// croc's receiver writes into the process's working directory, so a receive has to set it.
// Serialised by the caller: one transfer at a time is the only mode this app has.
func chdir(dir string) error { return os.Chdir(dir) }
