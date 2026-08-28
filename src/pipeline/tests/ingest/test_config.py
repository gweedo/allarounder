import pytest

from ingest.config import ConfigError, load_config


class TestLoadConfig:
    def test_loads_from_given_env(self) -> None:
        config = load_config({"GOOGLE_SERVICE_ACCOUNT_JSON": "{}", "SHEET_ID": "sheet-1"})
        assert config.sheet_id == "sheet-1"
        assert config.sheet_name == "Articoli"

    def test_custom_sheet_name(self) -> None:
        config = load_config(
            {"GOOGLE_SERVICE_ACCOUNT_JSON": "{}", "SHEET_ID": "sheet-1", "SHEET_NAME": "Editoriale"}
        )
        assert config.sheet_name == "Editoriale"

    def test_missing_service_account_raises(self) -> None:
        with pytest.raises(ConfigError, match="GOOGLE_SERVICE_ACCOUNT_JSON"):
            load_config({"SHEET_ID": "sheet-1"})

    def test_missing_sheet_id_raises(self) -> None:
        with pytest.raises(ConfigError, match="SHEET_ID"):
            load_config({"GOOGLE_SERVICE_ACCOUNT_JSON": "{}"})
