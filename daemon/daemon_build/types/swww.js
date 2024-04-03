"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionPosition = exports.TransitionType = exports.FilterType = exports.ResizeType = void 0;
var ResizeType;
(function (ResizeType) {
    ResizeType["crop"] = "crop";
    ResizeType["fit"] = "fit";
    ResizeType["none"] = "no";
})(ResizeType || (exports.ResizeType = ResizeType = {}));
var FilterType;
(function (FilterType) {
    FilterType["Lanczos3"] = "Lanczos3";
    FilterType["Bilinear"] = "Bilinear";
    FilterType["CatmullRom"] = "CatmullRom";
    FilterType["Mitchell"] = "Mitchell";
    FilterType["Nearest"] = "Nearest";
})(FilterType || (exports.FilterType = FilterType = {}));
var TransitionType;
(function (TransitionType) {
    TransitionType["none"] = "none";
    TransitionType["simple"] = "simple";
    TransitionType["fade"] = "fade";
    TransitionType["left"] = "left";
    TransitionType["right"] = "right";
    TransitionType["top"] = "top";
    TransitionType["bottom"] = "bottom";
    TransitionType["wipe"] = "wipe";
    TransitionType["wave"] = "wave";
    TransitionType["grow"] = "grow";
    TransitionType["center"] = "center";
    TransitionType["any"] = "any";
    TransitionType["outer"] = "outer";
    TransitionType["random"] = "random";
})(TransitionType || (exports.TransitionType = TransitionType = {}));
var transitionPosition;
(function (transitionPosition) {
    transitionPosition["center"] = "center";
    transitionPosition["top"] = "top";
    transitionPosition["left"] = "left";
    transitionPosition["right"] = "right";
    transitionPosition["bottom"] = "bottom";
    transitionPosition["topLeft"] = "top-left";
    transitionPosition["topRight"] = "top-right";
    transitionPosition["bottomLeft"] = "bottom-left";
    transitionPosition["bottomRight"] = "bottom-right";
})(transitionPosition || (exports.transitionPosition = transitionPosition = {}));
//# sourceMappingURL=swww.js.map