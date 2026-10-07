import { useEffect, useRef } from 'react';
import { useGoogleOAuth, type CredentialResponse, type GsiButtonConfiguration, type IdConfiguration } from '@react-oauth/google';

type GoogleIdentity = {
  initialize: (configuration: IdConfiguration) => void;
  renderButton: (element: HTMLElement, configuration: GsiButtonConfiguration & { locale?: string }) => void;
};
type SignInClient = { clientId: string; callback?: (credential: CredentialResponse) => void };

// GIS initialization is page-wide. Resize, theme changes and Strict Mode must
// only redraw the button, rather than resetting a sign-in popup's callback.
const clients = new WeakMap<GoogleIdentity, SignInClient>();

export function GoogleSignInButton({ dark, width, onCredential }: {
  dark: boolean;
  width: number;
  onCredential: (credential: CredentialResponse) => void;
}) {
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const identity = (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
    if (!scriptLoadedSuccessfully || !identity || !container.current) return;
    let client = clients.get(identity);
    if (!client || client.clientId !== clientId) {
      client = { clientId };
      const currentClient = client;
      identity.initialize({ client_id: clientId, auto_select: false, ux_mode: 'popup', callback: credential => currentClient.callback?.(credential) });
      clients.set(identity, client);
    }
    client.callback = onCredential;
    const currentClient = client;
    return () => { if (currentClient.callback === onCredential) currentClient.callback = undefined; };
  }, [clientId, scriptLoadedSuccessfully, onCredential]);

  useEffect(() => {
    const identity = (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
    const element = container.current;
    if (!scriptLoadedSuccessfully || !identity || !element) return;
    element.replaceChildren();
    identity.renderButton(element, { theme: dark ? 'filled_black' : 'outline', size: 'large', width, text: 'continue_with', shape: 'rectangular', locale: 'en' });
    return () => element.replaceChildren();
  }, [clientId, scriptLoadedSuccessfully, dark, width]);

  return <div ref={container} className="flex min-h-11 justify-center" />;
}
