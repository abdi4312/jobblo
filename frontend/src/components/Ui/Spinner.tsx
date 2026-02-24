import { InfinitySpin } from "react-loader-spinner";

export const Spinner = ({ size = 20, color = "#4fa94d" }) => (
    <InfinitySpin height={size} width={size} color={color} ariaLabel="loading" />
);