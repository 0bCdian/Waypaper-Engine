"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionPosition = exports.TransitionType = exports.FilterType = exports.ResizeType = exports.dbTables = exports.ACTIONS = exports.PLAYLIST_TYPES = exports.ORDER_TYPES = void 0;
var ORDER_TYPES;
(function (ORDER_TYPES) {
    ORDER_TYPES["ORDERED"] = "ordered";
    ORDER_TYPES["RANDOM"] = "random";
})(ORDER_TYPES || (exports.ORDER_TYPES = ORDER_TYPES = {}));
var PLAYLIST_TYPES;
(function (PLAYLIST_TYPES) {
    PLAYLIST_TYPES["TIMER"] = "timer";
    PLAYLIST_TYPES["NEVER"] = "never";
    PLAYLIST_TYPES["TIME_OF_DAY"] = "timeofday";
    PLAYLIST_TYPES["DAY_OF_WEEK"] = "dayofweek";
})(PLAYLIST_TYPES || (exports.PLAYLIST_TYPES = PLAYLIST_TYPES = {}));
var ACTIONS;
(function (ACTIONS) {
    ACTIONS["NEXT_IMAGE"] = "next-image";
    ACTIONS["PREVIOUS_IMAGE"] = "previous-image";
    ACTIONS["START_PLAYLIST"] = "start-playlist";
    ACTIONS["RANDOM_IMAGE"] = "random-image";
    ACTIONS["STOP_DAEMON"] = "stop-daemon";
    ACTIONS["PAUSE_PLAYLIST"] = "pause-playlist";
    ACTIONS["RESUME_PLAYLIST"] = "resume-playlist";
    ACTIONS["STOP_PLAYLIST"] = "stop-playlist";
    ACTIONS["UPDATE_CONFIG"] = "update-config";
    ACTIONS["ERROR"] = "error";
    ACTIONS["GET_INFO"] = "get-info";
})(ACTIONS || (exports.ACTIONS = ACTIONS = {}));
var dbTables;
(function (dbTables) {
    dbTables["Images"] = "Images";
    dbTables["Playlists"] = "Playlists";
    dbTables["imagesInPlaylist"] = "imagesInPlaylist";
    dbTables["swwwConfig"] = "swwwConfig";
    dbTables["appConfig"] = "appConfig";
    dbTables["activePlaylist"] = "activePlaylist";
})(dbTables || (exports.dbTables = dbTables = {}));
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
//# sourceMappingURL=daemonTypes.js.map