class ContentError(Exception):
    """Base for all content domain errors."""


class SlugLockedError(ContentError):
    """Raised when trying to change slug after publication."""


class ArticleNotFoundError(ContentError):
    pass


class PageNotFoundError(ContentError):
    pass
