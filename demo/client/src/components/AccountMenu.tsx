import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { LogOutIcon, SettingsIcon, UserPlusIcon } from './icons';

interface AccountMenuProps {
  /** The business name; shown as initials when there's no picture, and as the button's label. */
  name: string;
  imageUrl?: string | null;
  onLogout: () => void;
}

type Position = { top?: number; bottom?: number; left?: number; right?: number };

const MENU_GAP = 8;

/**
 * The avatar button in the sidebar and the menu it opens: Settings, Add account /
 * switch account, Log out. The menu is rendered into <body> and positioned by hand, because
 * the sidebar clips overflow on phones and would cut a normally-positioned popup off.
 */
export function AccountMenu({ name, imageUrl, onLogout }: AccountMenuProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  function close(returnFocus = false) {
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  }

  function toggle() {
    if (open) return close();
    const rect = buttonRef.current!.getBoundingClientRect();
    // At the bottom of the desktop sidebar the menu opens upward; in the phone top bar,
    // the avatar is near the top, so it opens downward, right-aligned under the button.
    setPosition(
      rect.top > window.innerHeight / 2
        ? { bottom: window.innerHeight - rect.top + MENU_GAP, left: rect.left }
        : {
            top: rect.bottom + MENU_GAP,
            right: Math.max(window.innerWidth - rect.right, MENU_GAP),
          },
    );
  }

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const dismiss = () => setPosition(null);
    const dismissOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) dismiss();
    };
    document.addEventListener('mousedown', dismissOnOutsideClick);
    // The menu is positioned once on open, so a resize or scroll would leave it misplaced.
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', dismissOnOutsideClick);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...menuRef.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusItem = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        focusItem(current - 1);
        break;
      case 'Home':
        focusItem(0);
        break;
      case 'End':
        focusItem(items.length - 1);
        break;
      case 'Tab':
        close();
        break;
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="sidebar__avatar"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        title={name}
      >
        <Avatar name={name} imageUrl={imageUrl} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="account-menu"
            role="menu"
            aria-label="Account"
            style={position}
            onKeyDown={handleMenuKeyDown}
          >
            {/* Placeholder until settings exist: looks real, does nothing yet. */}
            <button
              type="button"
              role="menuitem"
              className="account-menu__item"
              onClick={() => close()}
            >
              <SettingsIcon />
              Settings
            </button>
            {/* Placeholder until multiple accounts exist: does nothing yet. */}
            <button
              type="button"
              role="menuitem"
              className="account-menu__item"
              onClick={() => close()}
            >
              <UserPlusIcon />
              Add account / Switch account
            </button>
            <div className="account-menu__divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="account-menu__item"
              onClick={() => {
                close();
                onLogout();
              }}
            >
              <LogOutIcon />
              Log out
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
