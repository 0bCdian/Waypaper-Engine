run_app(){
  waypaper-engine.AppImage 2>/dev/null || echo "waypaper engine is not on the path, make sure to add it before running this command"
}

run_app & > /dev/null
