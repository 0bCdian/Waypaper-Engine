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
    ACTIONS["UPDATE_PLAYLIST"] = "update-playlist";
    ACTIONS["ERROR"] = "error";
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
var initialSwwwConfigDB = {
    resizeType: ResizeType.crop,
    fillColor: '#000000',
    filterType: FilterType.Lanczos3,
    transitionType: TransitionType.simple,
    transitionStep: 90,
    transitionDuration: 3,
    transitionFPS: 60,
    transitionAngle: 45,
    transitionPositionType: 'alias',
    transitionPosition: transitionPosition.center,
    transitionPositionIntX: 960,
    transitionPositionIntY: 540,
    transitionPositionFloatX: 0.5,
    transitionPositionFloatY: 0.5,
    invertY: 0,
    transitionBezier: '.25,.1,.25,1',
    transitionWaveX: 20,
    transitionWaveY: 20
};
