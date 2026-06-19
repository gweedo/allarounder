import enum
from dataclasses import dataclass


class UserRole(enum.Enum):
    admin = "admin"
    editor = "editor"


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        normalised = self.value.strip().lower()
        if "@" not in normalised or len(normalised) < 3:
            raise ValueError(f"Invalid email address: {self.value!r}")
        object.__setattr__(self, "value", normalised)

    def __str__(self) -> str:
        return self.value
