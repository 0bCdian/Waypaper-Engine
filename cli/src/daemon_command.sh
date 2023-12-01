run_daemon() {
      waypaper-engine.AppImage --daemon 2>/dev/null || echo "waypaper engine is not on the path, make sure to add it before running this command"
}

run_daemon & > /dev/null
