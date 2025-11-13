# Thing that should be fixed

[x] - done

## [1] Colors

This is a TUI app, shouldn't use #hex colors, use basic colors so it can work in all terminals and match everyone's theme.

## [x] Item name accidently wrap instead of truncate

In some cases in the Lists - Layer, item names will wrap to the next line instead of being truncated with ellipsis. This also causes the item below it to be covered and fully unvisible.

## [x] Show artist name after the track

In the First and the Second layer, the Artist name should be shown after the track name (like "Track Name - Artist Name").

## [x] Selected item should be remained when opening a new layer

When opening a new layer (for example, pressing Enter on an album to open its tracks), the selected item should be displayed in the same position as it was in the previous layer (gray). And other items in the previous layer and not be selected should be hidden.

## [x] list item loading indicator

When selecting a list item, should open a layer immediately and display a loading placeholder while loading the content.

don't hard code this thing, since we will be outputing different things in the future, like `launching...`, `deleting...`, etc.

```this will be the place holder for loading list's items
loading...
```

Should not open a layer when user select an [track] item, because tracks are loaded instantly.
