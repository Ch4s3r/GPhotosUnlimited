#include <cassert>
#include <string>

#include "../app/src/main/cpp/config_path.hpp"

namespace {

bool g_customPropExists = false;
bool g_customJsonExists = false;
std::string g_profileValue;

bool stubFileExists(const char *path) {
    if (std::string(path) == CUSTOM_PROP_FILE_PATH) return g_customPropExists;
    if (std::string(path) == CUSTOM_JSON_FILE_PATH) return g_customJsonExists;
    return false;
}

std::string stubReadProfile() {
    return g_profileValue;
}

void resetStubs() {
    g_customPropExists = false;
    g_customJsonExists = false;
    g_profileValue.clear();
}

}  // namespace

static void originalProfileSelectedByDefault() {
    resetStubs();
    assert(resolveConfigPath(stubFileExists, stubReadProfile) == ORIGINAL_PROP_FILE_PATH);
}

static void dataSaverProfileSelectsCoralPropFile() {
    resetStubs();
    g_profileValue = "datasaver";
    assert(resolveConfigPath(stubFileExists, stubReadProfile) == DATASAVER_PROP_FILE_PATH);
}

static void handWrittenCustomConfigOverridesProfile() {
    resetStubs();
    g_profileValue = "datasaver";
    g_customPropExists = true;
    assert(resolveConfigPath(stubFileExists, stubReadProfile) == CUSTOM_PROP_FILE_PATH);

    resetStubs();
    g_profileValue = "datasaver";
    g_customJsonExists = true;
    assert(resolveConfigPath(stubFileExists, stubReadProfile) == CUSTOM_JSON_FILE_PATH);
}

static void unknownProfileValueFallsBackToOriginal() {
    resetStubs();
    g_profileValue = "not-a-real-profile";
    assert(resolveConfigPath(stubFileExists, stubReadProfile) == ORIGINAL_PROP_FILE_PATH);
}

int main() {
    originalProfileSelectedByDefault();
    dataSaverProfileSelectsCoralPropFile();
    handWrittenCustomConfigOverridesProfile();
    unknownProfileValueFallsBackToOriginal();
    return 0;
}
