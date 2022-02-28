# parsegraph-window

This module provides the GraphicsWindow class, which arranges given Projecteds
in a grid. Newly added Projecteds can use half of an existing Projected's
space, either in the horizontal or vertical direction.

The GraphicsWindow itself is a Projected, so it must be attached using e.g.
a Projection to be added to a timing belt.
