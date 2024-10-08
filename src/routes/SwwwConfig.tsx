import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { BezierCurveEditor } from "react-bezier-curve-editor";
import { motion, AnimatePresence } from "framer-motion";
import { swwwConfigStore } from "../stores/swwwConfig";
import {
    type swwwConfigSelectType,
    type swwwConfigInsertType
} from "../../database/schema";
import {
    FilterType,
    ResizeType,
    type transitionPosition
} from "../../shared/types/swww";
let saveConfigTimeout: ReturnType<typeof setTimeout> | null = null;
const { readSwwwConfig } = window.API_RENDERER;
const SwwwConfig = () => {
    const { register, handleSubmit, watch, setValue } =
        useForm<swwwConfigInsertType["config"]>();
    const { saveConfig } = swwwConfigStore();
    const [transitionPositionType, setTransitionPositionType] =
        useState("alias");
    const [bezier, setBezier] = useState<[number, number, number, number]>([
        0.25, 1, 0.25, 1
    ]);
    const onSubmit = (data: swwwConfigInsertType["config"]) => {
        if (saveConfigTimeout !== null) {
            clearTimeout(saveConfigTimeout);
        }
        saveConfigTimeout = setTimeout(() => {
            if (
                data.transitionPositionFloatX === undefined ||
                data.transitionPositionFloatY === undefined
            ) {
                data.transitionPositionFloatX = 0.5;
                data.transitionPositionFloatY = 0.5;
            }
            if (
                data.transitionPositionIntY === undefined ||
                data.transitionPositionIntY === undefined
            ) {
                data.transitionPositionIntX = 960;
                data.transitionPositionIntY = 540;
            }
            saveConfig(data);
        }, 300);
    };

    // submit on change of inputs
    useEffect(() => {
        const { unsubscribe } = watch(() => {
            void handleSubmit(onSubmit)();
        });
        return () => {
            unsubscribe();
        };
    }, [handleSubmit, watch]);

    useEffect(() => {
        setTransitionPositionType(watch("transitionPositionType"));
    }, [watch("transitionPositionType")]);
    useEffect(() => {
        void readSwwwConfig().then((config: swwwConfigSelectType["config"]) => {
            const bezierArray = config.transitionBezier.split(",").map(item => {
                return parseFloat(item);
            }) as [number, number, number, number];
            setValue("resizeType", config.resizeType);
            setValue("fillColor", config.fillColor);
            setValue("filterType", config.filterType);
            setValue("transitionType", config.transitionType);
            setValue("transitionStep", config.transitionStep);
            setValue("transitionDuration", config.transitionDuration);
            setValue("transitionFPS", config.transitionFPS);
            setValue("transitionAngle", config.transitionAngle);
            setValue("invertY", config.invertY);
            setValue("transitionBezier", config.transitionBezier);
            setBezier(bezierArray);
            switch (config.transitionPositionType) {
                case "alias":
                    setValue(
                        "transitionPositionType",
                        config.transitionPositionType
                    );
                    setValue(
                        "transitionPosition",
                        config.transitionPosition as transitionPosition
                    );
                    break;
                case "float":
                    setValue(
                        "transitionPositionType",
                        config.transitionPositionType
                    );
                    setValue(
                        "transitionPositionFloatX",
                        config.transitionPositionFloatX
                    );
                    setValue(
                        "transitionPositionFloatY",
                        config.transitionPositionFloatY
                    );
                    break;
                case "int":
                    setValue(
                        "transitionPositionType",
                        config.transitionPositionType
                    );
                    setValue(
                        "transitionPositionIntX",
                        config.transitionPositionIntX
                    );
                    setValue(
                        "transitionPositionIntY",
                        config.transitionPositionIntY
                    );
                    break;
            }
        });
    }, []);
    return (
        <>
            <AnimatePresence>
                <motion.div
                    className="m-auto cursor-default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="self-center py-2 text-center text-7xl font-semibold">
                        Swww Settings
                    </h1>
                    <div className="divider"></div>
                    <div className="flex max-h-[75vh] min-h-0 w-full flex-col items-center justify-between overflow-y-scroll scrollbar-thin scrollbar-track-base-100 scrollbar-thumb-stone-300">
                        <form
                            className="form-control w-1/3"
                            onSubmit={() => {
                                void handleSubmit(_data => {});
                            }}
                        >
                            <div className="my-4">
                                <h2 className="text-3xl">Resize type</h2>
                                <label htmlFor="resizeType" className="label">
                                    <span className="label-text text-lg">
                                        Controls how the image is resized
                                    </span>
                                </label>
                                <select
                                    id="resizeType"
                                    className="select mt-3 w-full max-w-xs cursor-default rounded-md bg-[#323232] text-xl"
                                    {...register("resizeType")}
                                >
                                    <option value={ResizeType.crop}>
                                        Crop
                                    </option>
                                    <option value={ResizeType.fit}>Fit</option>
                                    <option value={ResizeType.none}>
                                        No Resize
                                    </option>
                                </select>
                            </div>
                            <div className="my-4">
                                <h2 className="text-3xl">Fill Color</h2>
                                <label htmlFor="fillColor" className="label">
                                    <span className="label-text text-lg">
                                        Padding color
                                    </span>
                                </label>
                                <input
                                    className="h-8 w-1/5 rounded-lg"
                                    type="color"
                                    id="fillColor"
                                    {...register("fillColor")}
                                />
                            </div>
                            <div className="divider"></div>
                            <div className="my-4">
                                <h2 className="text-3xl">Filter algorithm</h2>
                                <label htmlFor="filter" className="label">
                                    <span className="label-text text-lg">
                                        Filter to use when scaling images
                                    </span>
                                </label>
                                <select
                                    id="filter"
                                    defaultValue={FilterType.Lanczos3}
                                    className="select mt-3 w-full max-w-xs cursor-default rounded-md bg-[#323232] text-xl"
                                    {...register("filterType")}
                                >
                                    <option>Lanczos3</option>
                                    <option>Bilinear</option>
                                    <option>CatmullRom</option>
                                    <option>Mitchell</option>
                                    <option>Nearest</option>
                                </select>
                            </div>
                            <div className="divider"></div>
                            <div className="my-4">
                                <h2 className="text-5xl">Transitions</h2>
                                <h2 className="mt-6 text-3xl">
                                    Transition Type
                                </h2>
                                <label htmlFor="transition" className="label">
                                    <span className="label-text text-lg">
                                        Sets the transition type, default is
                                        simple.
                                    </span>
                                </label>
                                <details className="collapse bg-base-200">
                                    <summary className="collapse-title text-xl font-medium">
                                        Click me to expand transition
                                        explanation
                                    </summary>
                                    <div className="collapse-content">
                                        <p className="text-lg">
                                            The left, right, top and bottom
                                            options make the transition happen
                                            from that position to its opposite
                                            in the screen. <br></br>none is an
                                            alias to simple that also sets the
                                            transition-step to 255, this has the
                                            effect of the transition finishing
                                            instantly. <br></br> fade is similar
                                            to simple but the fade is controlled
                                            through the --transition-bezier
                                            flag.
                                            <br></br> wipe is similar to left
                                            but allows you to specify the angle
                                            for transition with the
                                            `--transition-angle` flag.<br></br>{" "}
                                            wave is similar to wipe sweeping
                                            line is wavy.
                                            <br></br> grow causes a growing
                                            circle to transition across the
                                            screen and allows changing the
                                            circle&aposs center position with
                                            the `--transition-pos` flag.{" "}
                                            <br></br>
                                            center is an alias to grow with
                                            position set to center of screen.
                                            <br></br> any is an alias to grow
                                            with position set to a random point
                                            on screen. outer is the same as grow
                                            but the circle shrinks instead of
                                            growing. Finally, random will select
                                            a transition effect at random
                                        </p>
                                    </div>
                                </details>
                                <select
                                    id="transition"
                                    defaultValue={"Simple"}
                                    className="select mt-3 w-full max-w-xs cursor-default rounded-md bg-[#323232] text-xl"
                                    {...register("transitionType")}
                                >
                                    <option value={"none"}>None</option>
                                    <option value={"simple"}>Simple</option>
                                    <option value={"fade"}>Fade</option>
                                    <option value={"left"}>Left</option>
                                    <option value={"right"}>Right</option>
                                    <option value={"top"}>Top</option>
                                    <option value={"bottom"}>Bottom</option>
                                    <option value={"wipe"}>Wipe</option>
                                    <option value={"wave"}>Wave</option>
                                    <option value={"grow"}>Grow</option>
                                    <option value={"center"}>Center</option>
                                    <option value={"any"}>Any</option>
                                    <option value={"outer"}>Outer</option>
                                    <option value={"random"}>Random</option>
                                </select>
                            </div>
                            <div className="mt-3">
                                <h2 className="text-3xl">Transition Steps</h2>
                                <label
                                    htmlFor="transitionStep"
                                    className="label"
                                >
                                    <span className="label-text text-lg">
                                        How fast the transition approaches the
                                        new image
                                    </span>
                                    <span className="label-text-alt text-lg">
                                        {watch("transitionStep")}
                                    </span>
                                </label>
                                <input
                                    type="range"
                                    id="transitionStep"
                                    className="range"
                                    step={1}
                                    defaultValue={90}
                                    min={1}
                                    max={255}
                                    {...register("transitionStep", {
                                        valueAsNumber: true
                                    })}
                                />
                            </div>
                            <div className="mt-6">
                                <h2 className="text-3xl">
                                    Transition Duration
                                </h2>
                                <label htmlFor="" className="label">
                                    <span className="label-text text-lg">
                                        How long the transition takes to
                                        complete in seconds. Note that this does
                                        not work with the simple transition
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                    step={1}
                                    defaultValue={3}
                                    min={1}
                                    {...register("transitionDuration", {
                                        valueAsNumber: true,
                                        validate: value => {
                                            return value > 0;
                                        }
                                    })}
                                />
                            </div>
                            <div>
                                <h2 className="mt-6 text-3xl">
                                    Transition Fps
                                </h2>
                                <label htmlFor="" className="label">
                                    <span className="label-text text-lg">
                                        Set this to your monitor&aposs refresh
                                        rate
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                    step={1}
                                    defaultValue={60}
                                    min={1}
                                    {...register("transitionFPS", {
                                        valueAsNumber: true,
                                        validate: value => {
                                            return value > 0;
                                        }
                                    })}
                                />
                            </div>
                            <div className="mt-6">
                                <h2 className="text-3xl">Transition Angle</h2>
                                <label htmlFor="" className="label">
                                    <span className="label-text text-lg">
                                        This is used for wipe and wave
                                        transitions. It controls the angle of
                                        the wipe
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    max={360}
                                    defaultValue={45}
                                    min={0}
                                    {...register("transitionAngle", {
                                        valueAsNumber: true,
                                        validate: value => {
                                            if (value < 0) {
                                                return false;
                                            } else if (value > 360) {
                                                return false;
                                            } else if (Number.isNaN(value)) {
                                                return false;
                                            }
                                            return true;
                                        }
                                    })}
                                    className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                />
                            </div>
                            <div className="mt-6">
                                <h2 className="text-3xl">
                                    Transition Position
                                </h2>
                                <label
                                    htmlFor="transitionPosition"
                                    className="label"
                                >
                                    <span className="label-text text-lg">
                                        This is only used for the grow and outer
                                        transitions, it controls the center of
                                        the circle. Default is center. Position
                                        values can be given in both percentage
                                        values and pixel values: float values
                                        are interpreted as percentages and
                                        integer values as pixel values eg:
                                        0.5,0.5 means 50% of the screen width
                                        and 50% of the screen height 200,400
                                        means 200 pixels from the left and 400
                                        pixels from the bottom
                                    </span>
                                </label>
                                <select
                                    id="transitionPositionType"
                                    className="select mt-3 w-full max-w-xs cursor-default rounded-md bg-[#323232] text-xl"
                                    {...register("transitionPositionType")}
                                >
                                    <option value="int">Integer</option>
                                    <option value="float">Float</option>
                                    <option value="alias">Alias</option>
                                </select>
                                {transitionPositionType === "alias" && (
                                    <select
                                        id="transitionPosition"
                                        {...register("transitionPosition")}
                                        defaultValue={"center"}
                                        className="select mt-3 w-full max-w-xs cursor-default rounded-md bg-[#323232] text-xl"
                                    >
                                        <option value="center">Center</option>
                                        <option value="top">Top</option>
                                        <option value="left">Left</option>
                                        <option value="right">Right</option>
                                        <option value="bottom">Bottom</option>
                                        <option value="top-left">
                                            Top-Left
                                        </option>
                                        <option value="top-right">
                                            Top-Right
                                        </option>
                                        <option value="bottom-left">
                                            Bottom-Left
                                        </option>
                                        <option value="bottom-right">
                                            Bottom-Right
                                        </option>
                                    </select>
                                )}
                                {transitionPositionType === "int" && (
                                    <div className="mt-3 flex gap-3">
                                        <input
                                            className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                            type="number"
                                            placeholder="X axis"
                                            step={1}
                                            min={0}
                                            defaultValue={960}
                                            {...register(
                                                "transitionPositionIntX",
                                                {
                                                    valueAsNumber: true,
                                                    validate: value => {
                                                        return value > 0;
                                                    }
                                                }
                                            )}
                                        />
                                        <input
                                            className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                            type="number"
                                            placeholder="Y axis"
                                            defaultValue={540}
                                            step={1}
                                            min={0}
                                            {...register(
                                                "transitionPositionIntY",
                                                {
                                                    valueAsNumber: true,
                                                    validate: value => {
                                                        return value > 0;
                                                    }
                                                }
                                            )}
                                        />
                                    </div>
                                )}
                                {transitionPositionType === "float" && (
                                    <div className="mt-3 flex gap-3">
                                        <input
                                            id="floatX"
                                            className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                            type="number"
                                            placeholder="Horizontal %"
                                            step={0.001}
                                            max={1}
                                            min={0}
                                            defaultValue={0.5}
                                            {...register(
                                                "transitionPositionFloatX",
                                                {
                                                    valueAsNumber: true,
                                                    validate: value => {
                                                        return (
                                                            value > 1 ||
                                                            !(value < 0)
                                                        );
                                                    }
                                                }
                                            )}
                                        />
                                        <input
                                            id="floatY"
                                            className="input w-1/2 rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                            type="number"
                                            placeholder="Vertical %"
                                            step={0.001}
                                            defaultValue={0.5}
                                            max={1}
                                            min={0}
                                            {...register(
                                                "transitionPositionFloatY",
                                                {
                                                    valueAsNumber: true,
                                                    validate: value => {
                                                        return (
                                                            value > 1 ||
                                                            !(value < 0)
                                                        );
                                                    }
                                                }
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="divider"></div>
                            <div className="mt-6">
                                <h2 className="text-3xl">Invert Y axis</h2>
                                <div className="flex gap-4">
                                    <label
                                        htmlFor="invertYTransitionPosition"
                                        className="label"
                                    >
                                        <span className="label-text text-lg">
                                            Inverts the y position sent in
                                            transition position
                                        </span>
                                    </label>
                                    <input
                                        type="checkbox"
                                        id="invertYTransitionPosition"
                                        className="checkbox checkbox-sm mt-3"
                                        {...register("invertY")}
                                    />
                                </div>
                            </div>
                            <div className="divider"></div>
                            <div className="mt-6 flex flex-col items-center gap-3">
                                <div className="space-y-3 self-start">
                                    <h2 className="text-4xl">
                                        Transition Bezier
                                    </h2>
                                    <span className="text-lg">
                                        Control the bezier curve of the
                                        transition, insert a comma separated
                                    </span>
                                    <input
                                        {...register("transitionBezier")}
                                        type="text"
                                        defaultValue={".25,.1,.25,1"}
                                        placeholder="bezier"
                                        className="input w-full rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                    />
                                </div>
                                <BezierCurveEditor
                                    onChange={e => {
                                        const value =
                                            e.toString() as `${number},${number},${number},${number}`;
                                        setValue("transitionBezier", value);
                                        setBezier(e);
                                    }}
                                    outerAreaSize={0}
                                    value={bezier}
                                    size={300}
                                    innerAreaColor="#CCCCCC"
                                    rowColor="#fff"
                                    strokeWidth={4}
                                    curveLineColor="#000"
                                    fixedHandleColor="#ebdbb2"
                                    outerAreaColor="#212121"
                                    handleLineColor="#323232"
                                    startHandleColor="#E75127"
                                    endHandleColor="#0092D6"
                                />
                            </div>
                            <div className="divider"></div>
                            <div className="mt-6 flex flex-col gap-3">
                                <h2 className="text-4xl">Transition Wave</h2>
                                <label className="label">
                                    <span className="label-text text-lg">
                                        This adjusts the width and height of the
                                        wave transition
                                    </span>
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="number"
                                        placeholder="width"
                                        min={1}
                                        step={1}
                                        defaultValue={20}
                                        {...register("transitionWaveX", {
                                            valueAsNumber: true
                                        })}
                                        className="input w-full rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="height"
                                        min={1}
                                        step={1}
                                        defaultValue={20}
                                        {...register("transitionWaveY", {
                                            valueAsNumber: true
                                        })}
                                        className="input w-full rounded-lg bg-[#323232] text-lg font-medium focus:outline-none"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </AnimatePresence>
        </>
    );
};

export default SwwwConfig;
