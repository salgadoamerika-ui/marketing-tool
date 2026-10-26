import { useEffect, useRef } from 'react';
import "./welcome-screen.css";

type WelcomeScreenProps = {
  name: string;
  onEnter: () => void;
  isLeaving: boolean;
};

export function WelcomeScreen({ name, onEnter, isLeaving }: WelcomeScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => { screenRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <div
      ref={screenRef}
      tabIndex={-1}
      className={`welcome-screen${isLeaving ? " welcome-screen--leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-headline"
      data-testid="welcome-screen"
    >
      <div className="welcome-glow" aria-hidden="true" />
      <div className="welcome-content">
        <p className="welcome-eyebrow">Adaptive Marketing Studio</p>
        <h1 id="welcome-headline" className="welcome-headline">
          Welcome <em>back</em>
        </h1>
        {name ? (
          <p className="welcome-name" data-testid="text-welcome-name">{name}</p>
        ) : null}
        <button
          type="button"
          className="welcome-enter"
          onClick={onEnter}
          disabled={isLeaving}
          data-testid="button-step-in"
        >
          <span>Step in</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </div>
  );
}

export default WelcomeScreen;
