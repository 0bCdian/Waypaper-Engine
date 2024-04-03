"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = exports.dbOperations = void 0;
const dbOperations_1 = require("../database/dbOperations");
exports.dbOperations = new dbOperations_1.DBOperations();
exports.configuration = {
    swww: {
        settings: exports.dbOperations.getSwwwConfig(),
        update: () => {
            exports.configuration.swww.settings = exports.dbOperations.getSwwwConfig();
        }
    },
    app: {
        settings: exports.dbOperations.getAppConfig(),
        update: () => {
            exports.configuration.app.settings = exports.dbOperations.getAppConfig();
        }
    },
    script: undefined
};
//# sourceMappingURL=config.js.map