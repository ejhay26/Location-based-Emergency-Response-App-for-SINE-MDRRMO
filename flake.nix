{
  description = "SINE MDRRMO Location-Based Emergency Response Desktop Application (Tauri v2 + Angular/Ionic)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      nixpkgsFor = forAllSystems (system: import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
        };
      });

      tauriLibraries = pkgs: with pkgs; [
        webkitgtk_4_1
        gtk3
        cairo
        gdk-pixbuf
        glib
        glib-networking
        gsettings-desktop-schemas
        pango
        libsoup_3
        openssl
        librsvg
        dbus
        libappindicator-gtk3
      ];

      buildTools = pkgs: with pkgs; [
        pkg-config
        rustc
        cargo
        makeWrapper
        nodejs_22
        nodePackages.npm
      ];
    in {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgsFor.${system};
        in {
          default = pkgs.stdenvNoCC.mkDerivation rec {
            pname = "mdrrmo-emergency-response-app";
            version = "0.84.7";

            src = ./.;

            nativeBuildInputs = buildTools pkgs;
            buildInputs = tauriLibraries pkgs;

            dontUseNpmInstall = true;

            buildPhase = ''
              set -euo pipefail

              export HOME="$TMPDIR/home"
              mkdir -p "$HOME"

              cd "$src/frontend"
              npm install --legacy-peer-deps --include=dev
              npm run build

              cd "$src/frontend/src-tauri"
              cargo build --release
            '';

            installPhase = ''
              set -euo pipefail

              mkdir -p "$out/bin"
              mkdir -p "$out/share/applications"
              mkdir -p "$out/share/icons/hicolor/128x128/apps"

              cp "$src/frontend/src-tauri/target/release/mdrrmo-emergency-response-app" "$out/bin/mdrrmo-emergency-response-app"

              wrapProgram "$out/bin/mdrrmo-emergency-response-app" \
                --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath (tauriLibraries pkgs)}" \
                --set WEBKIT_DISABLE_DMABUF_RENDERER 1 \
                --set WEBKIT_DISABLE_COMPOSITING_MODE 1 \
                --set GIO_MODULE_DIR "${pkgs.glib-networking}/lib/gio/modules" \
                --set XDG_DATA_DIRS "${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"

              if [ -f "$src/frontend/src-tauri/icons/128x128.png" ]; then
                cp "$src/frontend/src-tauri/icons/128x128.png" "$out/share/icons/hicolor/128x128/apps/mdrrmo-emergency-response-app.png"
              fi

              cat > "$out/share/applications/mdrrmo-emergency-response-app.desktop" <<EOF
[Desktop Entry]
Name=MDRRMO Emergency Response App
Comment=Location-Based Emergency Response App for SINE MDRRMO
Exec=$out/bin/mdrrmo-emergency-response-app
Icon=mdrrmo-emergency-response-app
Terminal=false
Type=Application
Categories=Utility;Emergency;
EOF
            '';

            meta = with pkgs.lib; {
              description = "Location-Based Emergency Response App for SINE MDRRMO";
              homepage = "https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO";
              license = licenses.unfree;
              platforms = platforms.linux;
              mainProgram = "mdrrmo-emergency-response-app";
            };
          };
        }
      );

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/mdrrmo-emergency-response-app";
        };
      });

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgsFor.${system};
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = buildTools pkgs;
            buildInputs = tauriLibraries pkgs;

            shellHook = ''
              export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath (tauriLibraries pkgs)}:$LD_LIBRARY_PATH"
              export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
              export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules"
              export WEBKIT_DISABLE_COMPOSITING_MODE=1
              export WEBKIT_DISABLE_DMABUF_RENDERER=1

              echo "SINE MDRRMO Desktop Frontend (NixOS / Tauri v2)"
              echo "Commands:"
              echo "  cd frontend"
              echo "  npm install --legacy-peer-deps"
              echo "  npm run build"
              echo "  cargo tauri build --release"
            '';
          };
        }
      );
    };
}
