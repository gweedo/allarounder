class IdentityError(Exception):
    """Base for all identity domain errors."""


class PasswordTooShortError(IdentityError):
    pass


class AccountLockedError(IdentityError):
    pass


class InvalidCredentialsError(IdentityError):
    pass


class TokenExpiredError(IdentityError):
    pass


class TokenRevokedError(IdentityError):
    pass


class UserNotFoundError(IdentityError):
    pass


class UserInactiveError(IdentityError):
    pass
