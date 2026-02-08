import {registerUIVariable} from "@impos2/kernel-base";
import {EmptyScreen} from "@impos2/ui-core-base-2";

export const desktopVariables = {
    rootScreenContainer: registerUIVariable({key: 'screen.container.root', defaultValue: EmptyScreen})
}