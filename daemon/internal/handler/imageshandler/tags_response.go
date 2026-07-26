package imageshandler

// TagsResponse is the JSON body for GET /images/tags.
type TagsResponse struct {
	Tags []string `json:"tags"`
}
