package backend

import "waypaper-engine/daemon/internal/monitor"

type BackendInfo struct {
	Name         string       `json:"name"`
	Available    bool         `json:"available"`
	Active       bool         `json:"active"`
	Capabilities Capabilities `json:"capabilities"`
}

type Registry interface {
	Register(b Backend) error
	Get(name string) (Backend, bool)
	Active() Backend
	HasActive() bool
	SetActive(name string) error
	Available() []BackendInfo
	Compatible(compositor monitor.CompositorType) []BackendInfo
}
