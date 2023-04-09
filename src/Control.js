import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import play from './play.svg';
import stop from './stop.svg';
const Control = ({ started, onStop, onStart }) => (_jsx("button", { className: "play-pause-button", onClick: () => (started ? onStop() : onStart()), children: started ? (_jsxs(_Fragment, { children: [_jsx("img", { src: stop, alt: "stop", style: { height: 32, marginRight: 8 } }), ' ', "Stop & Save"] })) : (_jsxs(_Fragment, { children: [_jsx("img", { src: play, alt: "play", style: { height: 32, marginRight: 8 } }), ' ', "Start"] })) }));
export default Control;
