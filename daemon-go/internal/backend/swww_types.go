package backend

type ImageFormat string

const (
	FormatJPG      ImageFormat = "jpg"
	FormatJPEG     ImageFormat = "jpeg"
	FormatPNG      ImageFormat = "png"
	FormatBMP      ImageFormat = "bmp"
	FormatGIF      ImageFormat = "gif"
	FormatWebP     ImageFormat = "webp"
	FormatFarbfeld ImageFormat = "farbfeld"
	FormatPNM      ImageFormat = "pnm"
	FormatTGA      ImageFormat = "tga"
	FormatTIFF     ImageFormat = "tiff"
)

// ResizeType defines how images should be resized
type ResizeType string

const (
	ResizeTypeCrop    ResizeType = "crop"
	ResizeTypeFit     ResizeType = "fit"
	ResizeTypeNone    ResizeType = "no"
	ResizeTypeStretch ResizeType = "stretch"
)

// FilterType defines the filter algorithm for resizing
type FilterType string

const (
	FilterTypeLanczos3   FilterType = "Lanczos3"
	FilterTypeBilinear   FilterType = "Bilinear"
	FilterTypeCatmullRom FilterType = "CatmullRom"
	FilterTypeMitchell   FilterType = "Mitchell"
	FilterTypeNearest    FilterType = "Nearest"
)

// TransitionType defines the transition effect
type TransitionType string

const (
	TransitionTypeNone   TransitionType = "none"
	TransitionTypeSimple TransitionType = "simple"
	TransitionTypeFade   TransitionType = "fade"
	TransitionTypeLeft   TransitionType = "left"
	TransitionTypeRight  TransitionType = "right"
	TransitionTypeTop    TransitionType = "top"
	TransitionTypeBottom TransitionType = "bottom"
	TransitionTypeWipe   TransitionType = "wipe"
	TransitionTypeWave   TransitionType = "wave"
	TransitionTypeGrow   TransitionType = "grow"
	TransitionTypeCenter TransitionType = "center"
	TransitionTypeAny    TransitionType = "any"
	TransitionTypeOuter  TransitionType = "outer"
	TransitionTypeRandom TransitionType = "random"
)

// TransitionPosition defines the position for transitions
type TransitionPosition string

const (
	TransitionPositionCenter      TransitionPosition = "center"
	TransitionPositionTop         TransitionPosition = "top"
	TransitionPositionLeft        TransitionPosition = "left"
	TransitionPositionRight       TransitionPosition = "right"
	TransitionPositionBottom      TransitionPosition = "bottom"
	TransitionPositionTopLeft     TransitionPosition = "top-left"
	TransitionPositionTopRight    TransitionPosition = "top-right"
	TransitionPositionBottomLeft  TransitionPosition = "bottom-left"
	TransitionPositionBottomRight TransitionPosition = "bottom-right"
)

// TransitionPositionType defines the type of position values
type TransitionPositionType string

const (
	TransitionPositionTypeAlias TransitionPositionType = "alias"
	TransitionPositionTypeInt   TransitionPositionType = "int"
	TransitionPositionTypeFloat TransitionPositionType = "float"
)
