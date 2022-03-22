import { handleRedirectFromLogin } from "./parse-redirect";
import { IAuthData } from "./types";
import {
  EmbeddedAppState,
  getEmbeddedAppState,
  getPreAuthFlowHref,
} from "./utils";

export const handlePopupWindowRedirect = (
  storage: Storage,
  authData: IAuthData
): EmbeddedAppState => {
  // Retrieve the state set by `genesys-cloud-client-auth`
  if (!authData.state) throw new Error("could not find `state` hash param");
  const gcAuthState = storage.getItem(authData.state);
  if (!gcAuthState)
    throw new Error("could not find gc-auth state stored locally");
  const { state: popupAuthState } = JSON.parse(gcAuthState);
  if (!popupAuthState || typeof popupAuthState !== "string") {
    throw new Error(
      "could not parse our popup auth state key from gc-auth state entry"
    );
  }
  const href = getPreAuthFlowHref(storage, popupAuthState);

  handleRedirectFromLogin();

  return getEmbeddedAppState(href);
};
