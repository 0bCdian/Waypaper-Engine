// Package shadowtest provides Apply-only test helpers for verifying backend
// setter-visible side effects (argv, config files, HTTP bodies) against expected
// values. Each backend exposes its capture seam through a separate adapter in
// shadowtest_<backend>.go.
package shadowtest
