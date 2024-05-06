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
                    className="grid items-center z-100 bg-base-100 h-screen w-screen"
                >
                    <motion.div className="sm:w-full text-5xl sm:text-7xl md:text-8xl xl:text-9xl text-center whitespace-nowrap font-medium py-2 pr-2">
                        Waypaper Engine
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default IntroScreen;
