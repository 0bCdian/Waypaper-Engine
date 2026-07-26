package imageshandler

// SelectAllResponse is the JSON body for POST /images/select-all.
type SelectAllResponse struct {
	Updated  int  `json:"updated"`
	Selected bool `json:"selected"`
}
