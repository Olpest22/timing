// Типы для interaction-kit.js (better-design). Файл подключается как side-effect и
// регистрирует глобальный BetterUI.
export {};

declare global {
  var BetterUI: {
    init(scope?: Document | HTMLElement): { destroy(): void };
    shake(el: Element): void;
  };
}
