interface SceneAvatarRendererOptions {
  avatarsByUser: Map<string, AvatarState>;
  avatarElements: Map<string, AvatarElements>;
  preloadedImages: Map<string, PreloadedImage>;
  penguinResourcesByLogin: Map<string, PenguinRenderResources>;
  getGeometry: () => SceneGeometry;
}

export function createSceneAvatarRenderer (options: SceneAvatarRendererOptions) {
  async function updateAvatar (
    avatar: AvatarState,
    direction: AvatarDirection,
    action: AvatarState["action"],
    gesture = avatar.gesture
  ): Promise<void> {
    avatar.direction = direction;
    if (avatar.avatarType === "penguin") {
      if (avatar.isSitting) avatar.action = "sit";
      else if (avatar.danceAction !== null) avatar.action = avatar.danceAction;
      else if (avatar.cleaning) avatar.action = "std";
      else if (action === "wlk" || action === "snowball") avatar.action = action;
      else avatar.action = "std";
      avatar.gesture = "std";
      avatar.currentImage = "penguin";
      await nextTick();
      if (!avatar.removed) placeAvatar(avatar);
      return;
    }

    avatar.action = avatar.isSitting ? "sit" : avatar.danceAction ?? action;
    avatar.gesture = gesture;
    const nextImage = habboImageUrl(avatar.direction, avatar.action, avatar.gesture, avatar.figure, avatar.effect);

    if (nextImage === avatar.currentImage && avatar.imageWidth > 0) {
      placeAvatar(avatar);
      return;
    }

    avatar.currentImage = nextImage;
    const image = await preloadHabboAvatar(
      options.preloadedImages,
      avatar.direction,
      avatar.action,
      avatar.gesture,
      avatar.figure,
      avatar.effect
    );
    if (avatar.removed) return;

    const latestImage = habboImageUrl(avatar.direction, avatar.action, avatar.gesture, avatar.figure, avatar.effect);
    if (nextImage !== latestImage) {
      await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture);
      return;
    }
    if (!image) throw new Error("No se pudo cargar la imagen del avatar.");

    avatar.imageWidth = image.naturalWidth * 1.08;
    avatar.imageHeight = image.naturalHeight * 1.08;
    await nextTick();
    if (avatar.removed) return;
    if (nextImage !== avatar.currentImage) {
      await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture);
      return;
    }
    placeAvatar(avatar);
  }

  function placeAvatar (avatar: AvatarState, now = performance.now()) {
    if (!avatar.visual) return;
    const geometry = options.getGeometry();
    const elements = options.avatarElements.get(avatar.login);
    const penguinBounds = avatar.avatarType === "penguin" ? renderPenguinAvatar(avatar, elements?.image, options.penguinResourcesByLogin.get(avatar.login), now) : null;
    const point = positionForTile(avatar.visual, geometry);
    const groundY = point.y + OVERLAY_SCENE.tileHeight * 0.34;
    const depth = Math.round(avatar.visual.column + avatar.visual.row);
    const visibleImageHeight = avatar.avatarType === "penguin" ? avatar.imageHeight : avatar.imageHeight / 2;
    const labelHalfWidth = (elements?.labelWidth ?? 0) / 2;
    const labelHeight = elements?.labelHeight ?? 0;
    const labelX = Math.max(
      labelHalfWidth + 8,
      Math.min(geometry.roomWidth - labelHalfWidth - 8, point.x)
    );

    const setPosition = (
      element: HTMLElement | null,
      x: number,
      y: number,
      zIndex?: number
    ) => {
      if (!element) return;
      const transform = `translate3d(${x}px, ${y}px, 0)`;
      if (element.style.transform !== transform) element.style.transform = transform;
      if (zIndex !== undefined && element.style.zIndex !== String(zIndex)) {
        element.style.zIndex = String(zIndex);
      }
    };

    setPosition(elements?.shadow ?? null, point.x - 34 * 0.6, groundY - 14 * 1.2, depth + 1);
    const imageX = avatar.avatarType === "penguin" ? point.x - avatar.imageWidth / 2 : point.x - avatar.imageWidth * 0.56;
    const imageY = groundY - visibleImageHeight;
    const penguinScaleX = penguinBounds ? avatar.imageWidth / penguinBounds.width : 0;
    const penguinScaleY = penguinBounds ? avatar.imageHeight / penguinBounds.height : 0;
    const clickTargetBounds = penguinBounds?.content;
    let clickTargetX = imageX + avatar.imageWidth * 0.25;
    let clickTargetY = imageY;
    let clickTargetWidth = avatar.imageWidth / 4;
    let clickTargetHeight = visibleImageHeight - 20;
    let clickTargetClipPath = "";
    if (clickTargetBounds) {
      clickTargetX = imageX;
      clickTargetY = imageY;
      clickTargetWidth = avatar.imageWidth;
      clickTargetHeight = visibleImageHeight;
      const clipTop = clickTargetBounds.y * penguinScaleY;
      const clipRight = avatar.imageWidth - (clickTargetBounds.x + clickTargetBounds.width) * penguinScaleX;
      const clipBottom = visibleImageHeight - (clickTargetBounds.y + clickTargetBounds.height) * penguinScaleY;
      const clipLeft = clickTargetBounds.x * penguinScaleX;
      clickTargetClipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
    }
    setPosition(elements?.image ?? null, imageX, imageY, depth + 2);
    setPosition(elements?.clickTarget ?? null, clickTargetX, clickTargetY, depth + 2);
    if (elements?.image && avatar.imageWidth > 0) {
      const width = `${avatar.imageWidth}px`;
      const height = `${visibleImageHeight}px`;
      if (elements.image.style.width !== width) elements.image.style.width = width;
      if (elements.image.style.height !== height) elements.image.style.height = height;
    }
    if (elements?.clickTarget && avatar.imageWidth > 0) {
      const width = `${clickTargetWidth}px`;
      const height = `${clickTargetHeight}px`;
      if (elements.clickTarget.style.width !== width) elements.clickTarget.style.width = width;
      if (elements.clickTarget.style.height !== height) elements.clickTarget.style.height = height;
      if (elements.clickTarget.style.clipPath !== clickTargetClipPath) {
        elements.clickTarget.style.clipPath = clickTargetClipPath;
      }
    }
    setPosition(
      elements?.label ?? null,
      labelX - labelHalfWidth,
      groundY - visibleImageHeight - labelHeight / 2,
      depth + 3
    );
    setPosition(
      elements?.popoverAnchor ?? null,
      point.x,
      groundY - visibleImageHeight - labelHeight * 0.7 + 8
    );
    setPosition(
      elements?.menuAnchor ?? null,
      point.x,
      groundY - visibleImageHeight - labelHeight * 0.7 + 8
    );
  }

  function setAvatarElement (login: string, part: AvatarPart, value: AvatarElementRef) {
    const elements = options.avatarElements.get(login) ?? {
      shadow: null,
      image: null,
      clickTarget: null,
      label: null,
      popoverAnchor: null,
      menuAnchor: null,
      labelWidth: 0,
      labelHeight: 0
    };

    if (part === "image") {
      elements.image = (
        (typeof HTMLImageElement !== "undefined" && value instanceof HTMLImageElement)
        || (typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement)
      ) ? value : null;
    }
    else {
      const element = typeof HTMLElement !== "undefined" && value instanceof HTMLElement ? value : null;
      elements[part] = element;
      if (part === "label" && element) {
        elements.labelWidth = element.offsetWidth;
        elements.labelHeight = element.offsetHeight;
      }
    }

    if (elements.shadow || elements.image || elements.clickTarget || elements.label || elements.popoverAnchor || elements.menuAnchor) {
      options.avatarElements.set(login, elements);
    }
    else {
      options.avatarElements.delete(login);
    }

    const avatar = options.avatarsByUser.get(login);
    if (avatar && value !== null) placeAvatar(avatar);
  }

  return {
    placeAvatar,
    setAvatarElement,
    updateAvatar
  };
}
