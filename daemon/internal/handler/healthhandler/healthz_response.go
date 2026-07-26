package healthhandler

type HealthzResponse struct {
	Status               string   `json:"status"`
	MonitorStackVersion  int      `json:"monitor_stack_version"`
	MonitorProviderOrder []string `json:"monitor_provider_order"`
}
