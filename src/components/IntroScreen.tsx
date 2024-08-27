import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

function IntroScreen() {
    const [showIntro, setShowIntro] = useState(true);
    useEffect(() => {
        setTimeout(() => {
            setShowIntro(false);
        }, 2500);
    }, []);

    return (
        <AnimatePresence>
            {showIntro && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        duration: "1"
                    }}
                    className="z-100 grid h-screen w-screen items-center bg-base-100"
                >
                    <motion.div className="whitespace-nowrap py-2 pr-2 text-center text-5xl font-medium sm:w-full sm:text-7xl md:text-8xl xl:text-9xl">
                        Waypaper Engine
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default IntroScreen;
