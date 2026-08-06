import {StyleSheet} from 'react-native'

import type {NativeTheme} from './nativeTheme'

/**
 * The native viewer's `StyleSheet` factory (M8 Task 3) — takes a resolved
 * {@link NativeTheme} and returns a `StyleSheet.create`-built object every
 * `src/native/*Native.tsx` component reads from via `useNativeTourContext
 * ().styles`. Colors come from `theme` ONLY, never a hardcoded literal
 * (constraint from the plan), so re-theming a tour never requires touching
 * this file — everything downstream of `resolveNativeTheme` (`./nativeTheme.ts`)
 * just works.
 *
 * A fresh object per `theme` identity (`GuidedTourNative.tsx` calls this
 * inside a `useMemo` keyed on `theme`) — `StyleSheet.create` itself doesn't
 * cache across calls with different inputs, and doesn't need to: it's a
 * cheap, allocation-only call (no native bridge round-trip on the RN side;
 * on real RN it registers the styles with an internal ID table, but that
 * registration is deliberately re-cheap for exactly this "recompute when
 * theme changes" use case).
 *
 * Layout choices are deliberately minimal for v1 (record in the Task 3
 * report, not this file): a fixed default stage aspect ratio (16:9) that
 * `StepNative`'s `onLayout`-measured contain-fit math (`./layout.ts`)
 * letterboxes any actual screenshot aspect ratio within, rather than
 * trying to size the stage to match each step's own aspect ratio exactly
 * (which would make the "contain-fit math" this task explicitly asks for
 * pointless — the whole point is a stage box that DOESN'T necessarily
 * match the image's own aspect).
 *
 * @public
 */
export function createStyles(theme: NativeTheme) {
  const fontFamily = theme.fontFamily ?? undefined
  const half = theme.hotspotSize / 2
  // M10 Task 3: `mac`/`windows` render NO chrome on native at all (design
  // spec §17 — a title bar with traffic lights/caption glyphs is a web-only
  // concept, no RN component exists for it in v1); `simple` is the one
  // style with a real native effect — a plain border applied to the STEP
  // STAGE (`stage`, below — the screenshot + positioned-elements box
  // `StepNative.tsx` renders), not the outer `container` — narrower scope
  // than web's `<Frame>` (which wraps the whole step/outro/lead swap
  // region), a deliberate v1 simplification since native's per-step
  // `stage` is the one View this codebase already calls "the stage."
  const simpleFrameBorder =
    theme.frame.style === 'simple'
      ? {
          borderWidth: theme.frame.borderWidth,
          borderColor: theme.frame.borderColor,
          borderRadius: theme.frame.borderRadius,
        }
      : undefined

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: theme.radius,
      overflow: 'hidden',
    },
    empty: {padding: 16},
    header: {padding: 12},
    title: {fontSize: 18, fontWeight: '600', color: theme.text, fontFamily},

    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.overlay,
      overflow: 'hidden',
      marginTop: 8,
    },
    progressFill: {height: '100%', backgroundColor: theme.accent},

    chapterRow: {marginTop: 8},
    chapterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.buttonRadius,
      backgroundColor: theme.overlay,
      marginRight: 8,
    },
    chapterChipActive: {backgroundColor: theme.buttonBackground},
    chapterChipText: {color: theme.text, fontFamily, fontSize: 13},
    chapterChipTextActive: {color: theme.buttonText, fontFamily, fontSize: 13},

    stage: {
      width: '100%',
      aspectRatio: 16 / 9,
      position: 'relative',
      backgroundColor: theme.overlay,
      ...simpleFrameBorder,
    },
    screenshot: {width: '100%', height: '100%'},
    elementsLayer: {...StyleSheet.absoluteFill},

    hotspot: {
      position: 'absolute',
      width: theme.hotspotSize,
      height: theme.hotspotSize,
      marginLeft: -half,
      marginTop: -half,
      borderRadius: half,
      backgroundColor: theme.accent,
    },
    // Web parity, `Hotspot.tsx`: `pulse && !prefersReducedMotion()` swaps
    // in `.gt-hotspot--pulse` (an animated CSS ring). v1 adds no
    // `Animated`-driven motion (see this file's own doc comment and Ruling
    // B in `./reducedMotion.ts`) — this is a STATIC ring (a wider
    // translucent border standing in for where a future pulse animation
    // would grow/fade) applied under the exact same condition, so the
    // gated behavior itself has real, testable parity even though the
    // MOTION does not yet exist.
    hotspotPulseRing: {
      borderWidth: 3,
      borderColor: theme.accent,
    },

    tooltipAnchor: {position: 'absolute'},
    tooltipTrigger: {
      width: theme.hotspotSize,
      height: theme.hotspotSize,
      marginLeft: -half,
      marginTop: -half,
      borderRadius: half,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tooltipPanel: {
      position: 'absolute',
      backgroundColor: theme.bubbleBackground,
      borderRadius: theme.bubbleRadius,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.overlay,
    },
    // `left: -half` centers the panel's left edge under the trigger's own
    // center point horizontally, mirroring web's `.gt-tooltip--top/bottom`
    // `left: 50%; transform: translateX(-50%)` — a fixed offset rather
    // than a percentage since `panelWidth` (the caller-supplied `width`)
    // is a concrete pixel number by the time this is applied.
    tooltipPanelBelow: {top: half + 8},
    tooltipPanelAbove: {bottom: half + 8},
    tooltipText: {color: theme.bubbleText, fontFamily, fontSize: 14},

    overlayBase: {
      position: 'absolute',
      borderRadius: theme.radius,
      padding: 10,
      overflow: 'hidden',
    },
    overlaySurfaceBackground: {backgroundColor: theme.surface},
    overlayContrastBackground: {backgroundColor: theme.text},
    overlayAccentBackground: {backgroundColor: theme.accent},
    overlayNoneBackground: {backgroundColor: 'transparent'},
    overlayText: {color: theme.text, fontFamily, fontSize: 14},

    controls: {flexDirection: 'row', alignItems: 'center', padding: 12},
    button: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.buttonRadius,
      backgroundColor: theme.buttonBackground,
    },
    buttonText: {color: theme.buttonText, fontFamily, fontWeight: '600', fontSize: 14},
    counterText: {marginHorizontal: 12, color: theme.text, fontFamily, fontSize: 13},

    dotsRow: {flexDirection: 'row', marginLeft: 'auto'},
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.overlay,
      marginHorizontal: 3,
    },
    dotActive: {backgroundColor: theme.accent},

    outroContainer: {padding: 16},
    outroHeading: {fontSize: 20, fontWeight: '700', color: theme.text, fontFamily, marginBottom: 8},
    outroBody: {color: theme.text, fontFamily, fontSize: 14},
    ctaRow: {flexDirection: 'row', marginTop: 16, flexWrap: 'wrap'},
    ctaPrimary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.buttonRadius,
      backgroundColor: theme.buttonBackground,
      marginRight: 8,
      marginBottom: 8,
    },
    // Web parity (`styles.css`'s `.gt-cta--secondary`, M10 Task 2 report):
    // an outline/secondary CTA picks up ONLY the shared button radius, not
    // the fill colors — it keeps its own pre-M10 `overlay` background and
    // `surface` text (`ctaTextSecondary`, below) rather than
    // `buttonBackground`/`buttonText`, the same "elevation is reserved for
    // contained buttons" reasoning web's own comment gives.
    ctaSecondary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.buttonRadius,
      backgroundColor: theme.overlay,
      marginRight: 8,
      marginBottom: 8,
    },
    ctaTextPrimary: {color: theme.buttonText, fontFamily, fontWeight: '600', fontSize: 14},
    ctaTextSecondary: {color: theme.surface, fontFamily, fontWeight: '600', fontSize: 14},

    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalPanel: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '90%',
      backgroundColor: theme.surface,
      borderRadius: theme.radius,
      overflow: 'hidden',
    },
    modalCloseButton: {position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 8},
    modalCloseText: {color: theme.text, fontSize: 20, fontFamily},

    visuallyHidden: {position: 'absolute', width: 1, height: 1, overflow: 'hidden'},
  })
}

/** The return type of {@link createStyles} — the shape `NativeTourContextValue.styles` (`./context.ts`) carries. */
export type NativeStyles = ReturnType<typeof createStyles>
