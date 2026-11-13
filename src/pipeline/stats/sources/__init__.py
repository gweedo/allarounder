"""Source adapters: each turns one external source into a SourceResult."""


class SourceError(Exception):
    """Raised by a source adapter when its input no longer has the expected
    shape (unknown nation, missing column, too few rows...). Always fatal."""
