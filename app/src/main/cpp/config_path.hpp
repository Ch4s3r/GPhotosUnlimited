#pragma once

#include <cstdio>
#include <string>
#include <unistd.h>

#define ORIGINAL_PROP_FILE_PATH "/data/adb/modules/unlimitedphotos/fgp.prop"
#define DATASAVER_PROP_FILE_PATH "/data/adb/modules/unlimitedphotos/datasaver.fgp.prop"
#define CUSTOM_PROP_FILE_PATH "/data/adb/modules/unlimitedphotos/custom.fgp.prop"
#define CUSTOM_JSON_FILE_PATH "/data/adb/modules/unlimitedphotos/custom.fgp.json"
#define PROFILE_FILE_PATH "/data/adb/modules/unlimitedphotos/custom.profile.prop"

// Trailing whitespace in a config value ends up spoofed verbatim otherwise.
inline void trim(std::string &str) {
    size_t last = str.find_last_not_of(" \t\r\n");
    if (last == std::string::npos) {
        str.clear();
        return;
    }
    str.resize(last + 1);
    str.erase(0, str.find_first_not_of(" \t"));
}

// Parses one "key=value" line, using the same rules as the .prop -> JSON converter: skip blank
// and comment lines, split on the first '=', truncate the value at a trailing '#' comment.
inline std::string readPropKey(FILE *file, const char *key) {
    if (!file) return "";
    char lineBuf[256];
    std::string result;
    while (fgets(lineBuf, sizeof(lineBuf), file)) {
        std::string line(lineBuf);
        trim(line);
        if (line.empty() || line[0] == '#') continue;
        size_t equalsPos = line.find('=');
        if (equalsPos == std::string::npos) continue;
        std::string name = line.substr(0, equalsPos);
        std::string value = line.substr(equalsPos + 1);
        trim(name);
        size_t commentPos = value.find('#');
        if (commentPos != std::string::npos) value = value.substr(0, commentPos);
        trim(value);
        if (name == key) {
            result = value;
            break;
        }
    }
    fclose(file);
    return result;
}

inline bool configFileExists(const char *path) {
    return access(path, F_OK) == 0;
}

inline std::string readProfileSelection() {
    return readPropKey(fopen(PROFILE_FILE_PATH, "r"), "profile");
}

using FileExistsFn = bool (*)(const char *path);
using ReadProfileFn = std::string (*)();

// Precedence: a hand-written custom config always wins (nothing the user wrote by hand should be
// silently overwritten by a WebUI selection); otherwise the WebUI profile picks which shipped
// profile to load. An absent/unreadable profile file, or an unrecognised value, means "original".
inline std::string resolveConfigPath(FileExistsFn fileExists, ReadProfileFn readProfile) {
    if (fileExists(CUSTOM_PROP_FILE_PATH)) return CUSTOM_PROP_FILE_PATH;
    if (fileExists(CUSTOM_JSON_FILE_PATH)) return CUSTOM_JSON_FILE_PATH;
    if (readProfile() == "datasaver") return DATASAVER_PROP_FILE_PATH;
    return ORIGINAL_PROP_FILE_PATH;
}
