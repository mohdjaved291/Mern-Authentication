// theme.ts (Version 2 needs to be a tsx file, due to usage of StyleFunctions)
import { baseTheme, extendTheme } from '@chakra-ui/react';
import buttonTheme from "./buttonTheme";
import linkTheme from "./linkTheme";


const config = {
    initialColorMode: "dark",
    useSystemColorMode: false
}

const colors = {
    theme: {
        primary: baseTheme.colors.blue[500],
        primaryDark: baseTheme.colors.blue[600],
    },
    text: {
        muted: baseTheme.colors.gray[400],
    }
};
// Version 1: Using objects
const theme = extendTheme({
    config,
    colors,
    components: {
        Button: buttonTheme,
        Link: linkTheme,
    },
});

export default theme;