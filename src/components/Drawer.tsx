import { type FC, useState } from "react";
import { Link } from "react-router-dom";

interface Props {
    children: React.ReactNode;
}
const { exitApp } = window.API_RENDERER;
const Drawer: FC<Props> = ({ children }) => {
    const [show, setShow] = useState(false);
    const toggle = () => {
        setShow(prev => !prev);
    };
    return (
        <div className="drawer select-none">
            <input
                id="my-drawer"
                type="checkbox"
                className="drawer-toggle"
                checked={show}
                onChange={toggle}
            />
            <div className="drawer-content overflow-x-hidden overflow-y-scroll [contain:paint] sm:max-h-[100dvh] sm:scrollbar-none">
                {children}
            </div>
            <div className="drawer-side">
                <label htmlFor="my-drawer" className="drawer-overlay"></label>
                <ul className="menu h-full rounded-box bg-base-200 p-4 text-2xl text-base-content">
                    <li>
                        <Link draggable={false} onClick={toggle} to="/">
                            Gallery
                        </Link>
                    </li>
                    <li>
                        <Link
                            draggable={false}
                            onClick={toggle}
                            to="/swwwConfig"
                        >
                            Swww configuration
                        </Link>
                    </li>
                    <li>
                        <Link
                            draggable={false}
                            onClick={toggle}
                            to="/appConfig"
                        >
                            App configuration
                        </Link>
                    </li>
                    <li>
                        <a
                            draggable={false}
                            onClick={() => {
                                const quit = window.confirm(
                                    "Are you sure you want to quit"
                                );
                                if (quit) {
                                    exitApp();
                                }
                            }}
                        >
                            Quit Waypaper Engine
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Drawer;
