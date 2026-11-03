{
  description = "SINE MDRRMO Location-Based Emergency Response Desktop Application (Tauri v2)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      pname = "mdrrmo-emergency-response-app";
      version = (builtins.fromTOML (builtins.readFile ./frontend/src-tauri/Cargo.toml)).package.version;
      identifier = (builtins.fromJSON (builtins.readFile ./frontend/src-tauri/tauri.conf.json)).identifier;
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      runtimeLibs = pkgs: with pkgs; [
        webkitgtk_4_1
        gtk3
        libsoup_3
        glib-networking
        openssl
      ];

      # WebKitGTK loads these at runtime for media/audio (appsink, autoaudiosink, ...).
      gstPlugins = pkgs: with pkgs.gst_all_1; [
        gstreamer
        gst-plugins-base
        gst-plugins-good
        gst-plugins-bad
        gst-libav
      ];
    in {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfreePredicate = pkg: nixpkgs.lib.getName pkg == pname;
          };
          inherit (pkgs) lib;
        in {
          default = pkgs.rustPlatform.buildRustPackage {
            inherit pname version;

            # Only the Rust crate and the prebuilt Angular output (tracked in git).
            src = lib.fileset.toSource {
              root = ./frontend;
              fileset = lib.fileset.unions [
                ./frontend/src-tauri
                ./frontend/www
              ];
            };
            sourceRoot = "source/src-tauri";

            cargoLock.lockFile = ./frontend/src-tauri/Cargo.lock;

            # Embed ../www into the binary instead of loading devUrl.
            buildFeatures = [ "tauri/custom-protocol" ];
            doCheck = false;

            nativeBuildInputs = with pkgs; [ pkg-config wrapGAppsHook3 copyDesktopItems ];
            buildInputs = runtimeLibs pkgs ++ gstPlugins pkgs;

            preFixup = ''
              gappsWrapperArgs+=(
                --prefix GST_PLUGIN_SYSTEM_PATH_1_0 : "${lib.makeSearchPath "lib/gstreamer-1.0" (gstPlugins pkgs)}"
              )
            '';

            # File name = Tauri identifier, so Wayland app-id -> desktop entry -> icon matches.
            desktopItems = [
              (pkgs.makeDesktopItem {
                name = identifier;
                desktopName = "MDRRMO Emergency Response App";
                comment = "Location-Based Emergency Response App for SINE MDRRMO";
                exec = pname;
                icon = pname;
                terminal = false;
                categories = [ "Utility" ];
                startupWMClass = pname;
              })
            ];

            postInstall = ''
              install -Dm644 icons/128x128.png \
                "$out/share/icons/hicolor/128x128/apps/${pname}.png"
            '';

            meta = {
              description = "Location-Based Emergency Response App for SINE MDRRMO";
              homepage = "https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO";
              license = lib.licenses.unfree;
              platforms = lib.platforms.linux;
              mainProgram = pname;
            };
          };
        });

      devShells = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system}; in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [ pkg-config rustc cargo cargo-tauri nodejs_22 ];
            buildInputs = runtimeLibs pkgs ++ gstPlugins pkgs;

            shellHook = ''
              export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath (runtimeLibs pkgs)}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
              export GIO_EXTRA_MODULES="${pkgs.glib-networking}/lib/gio/modules''${GIO_EXTRA_MODULES:+:$GIO_EXTRA_MODULES}"
              export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}''${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
            '';
          };
        });
    };
}
