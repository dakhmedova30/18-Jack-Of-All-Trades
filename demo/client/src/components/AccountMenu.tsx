import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { HelpCircleIcon, LogOutIcon, MoreIcon, SettingsIcon, UserPlusIcon } from './icons';

interface AccountMenuProps {
  /** The business name; shown as initials when there's no picture, and as the button's label. */
  name: string;
  imageUrl?: string | null;
  /** Shown under the name in the sidebar pill. */
  email?: string;
  onLogout: () => void;
}

type Position = { top?: number; bottom?: number; left?: number; right?: number };

const MENU_GAP = 8;

/**
 * The avatar button in the sidebar and the menu it opens: Settings, Add account /
 * switch account, Log out. The menu is rendered into <body> and positioned by hand, because
 * the sidebar clips overflow on phones and would cut a normally-positioned popup off.
 */
export function AccountMenu({ name, imageUrl, email, onLogout }: AccountMenuProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const navigate = useNavigate();
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
        <Avatar key={imageUrl ?? 'initials'} name={name} imageUrl={imageUrl} />
        <span className="sidebar__avatar-text">
          <span className="sidebar__avatar-name">{name}</span>
          {email && <span className="sidebar__avatar-email">{email}</span>}
        </span>
        <span className="sidebar__avatar-more" aria-hidden="true">
          <MoreIcon />
        </span>
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
            <button
              type="button"
              role="menuitem"
              className="account-menu__item"
              onClick={() => {
                close();
                navigate('/settings');
              }}
            >
              <SettingsIcon />
              Settings
            </button>
            {/* One business per login for now, so this is a placeholder: it can be focused but does nothing. */}
            <button
              type="button"
              role="menuitem"
              aria-disabled="true"
              className="account-menu__item account-menu__item--disabled"
            >
              <UserPlusIcon />
              Add account / Switch account
              <span className="account-menu__soon">Coming soon</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="account-menu__item"
              onClick={() => {
                close();
                navigate('/help');
              }}
            >
              <HelpCircleIcon />
              Help and Support
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
            <div className="account-menu__legal">
              <Link to="/terms" role="menuitem" onClick={() => close()}>
                Terms
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/privacy" role="menuitem" onClick={() => close()}>
                Privacy
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
