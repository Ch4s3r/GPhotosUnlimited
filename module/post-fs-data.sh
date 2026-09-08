MODPATH="${0%/*}"

# Snapshot which profile is taking effect this boot, before the WebUI can change
# custom.profile.prop again, so the WebUI can tell a picked-but-not-yet-active profile
# apart from one that is already loaded.
PROFILE=original
[ -f "$MODPATH/custom.profile.prop" ] && CONFIGURED=$(grep -m1 '^profile=' "$MODPATH/custom.profile.prop" | cut -d= -f2) && [ "$CONFIGURED" ] && PROFILE=$CONFIGURED
echo "$PROFILE" > "$MODPATH/.active_profile"

# Remove Google Photos from Magisk DenyList when set to Enforce in normal mode
if magisk --denylist status; then
    magisk --denylist rm com.google.android.apps.photos
fi
# Run common tasks for installation and boot-time
. $MODPATH/common_setup.sh