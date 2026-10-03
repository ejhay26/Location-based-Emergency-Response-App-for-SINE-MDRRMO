<?php

namespace App\Traits;

use Illuminate\Support\Facades\Storage;

/**
 * MediaHandling — shared file decode, validate, name, and store logic.
 *
 * Used by AuthController (profile pictures, ID proofs) and
 * EmergencyController (SOS / hazard proof files).
 *
 * Security model
 * ──────────────
 * 1. decodeBase64()          — strips MIME prefix, decodes strictly, rejects < 100 B
 * 2. detectMime()            — reads magic bytes to confirm type regardless of header
 * 3. checkSize()             — enforces per-category decoded-byte ceiling
 * 4. makeFilename()          — collision-proof, path-safe filenames
 * 5. storePublic/Private()   — writes to the correct disk
 *
 * Allowed types
 * ─────────────
 * Images : PNG  (magic: 89 50 4E 47 at offset 0)
 *          JPEG (magic: FF D8 FF    at offset 0)
 * Video  : MP4  (magic: 66 74 79 70 at offset 4 — the "ftyp" ISO box)
 */
trait MediaHandling
{
    // ── Size ceilings (decoded bytes) ────────────────────────────────────────
    private const MAX_PROFILE_BYTES = 5_242_880;   //  5 MB
    private const MAX_ID_BYTES      = 10_485_760;  // 10 MB
    private const MAX_PROOF_BYTES   = 10_485_760;  // 10 MB per file

    // ── Magic-byte signatures ────────────────────────────────────────────────
    // Each entry: offset (bytes from start), hex string to match.
    private const SIGNATURES = [
        'image/png'  => ['offset' => 0, 'hex' => '89504e47'],
        'image/jpeg' => ['offset' => 0, 'hex' => 'ffd8ff'],
        'video/mp4'  => ['offset' => 4, 'hex' => '66747970'],
        'video/webm' => ['offset' => 0, 'hex' => '1a45dfa3'],
    ];

    private const EXTENSIONS = [
        'image/png'  => 'png',
        'image/jpeg' => 'jpg',
        'video/mp4'  => 'mp4',
        'video/webm' => 'webm',
    ];

    // ── 1. Decode ────────────────────────────────────────────────────────────

    protected function decodeBase64(string $data): string|false
    {
        if (str_contains($data, ';base64,')) {
            $parts = explode(';base64,', $data, 2);
            $data  = $parts[1] ?? '';
        }
        if ($data === '') return false;
        $decoded = base64_decode($data, true);
        if ($decoded === false || strlen($decoded) < 100) return false;
        return $decoded;
    }

    // ── 2. MIME detection via magic bytes ────────────────────────────────────

    protected function detectMime(string $binary): string|null
    {
        foreach (self::SIGNATURES as $mime => $sig) {
            $sigBytes  = strlen(hex2bin($sig['hex']));
            $slice     = bin2hex(substr($binary, $sig['offset'], $sigBytes));
            if ($slice === $sig['hex']) return $mime;
        }
        return null;
    }

    protected function mimeToExtension(string $mime): string
    {
        return self::EXTENSIONS[$mime] ?? 'bin';
    }

    // ── 3. Size check ────────────────────────────────────────────────────────

    protected function checkSize(string $binary, string $category): bool
    {
        $ceiling = match ($category) {
            'profile' => self::MAX_PROFILE_BYTES,
            'id'      => self::MAX_ID_BYTES,
            default   => self::MAX_PROOF_BYTES,
        };
        return strlen($binary) <= $ceiling;
    }

    // ── 4. Filename generation ───────────────────────────────────────────────

    protected function makeFilename(string $type, int $userId, string $ext): string
    {
        return sprintf('%s_%d_%s_%s.%s',
            $type, $userId, now()->format('YmdHis'), uniqid(), $ext
        );
    }

    // ── 5. Store helpers ─────────────────────────────────────────────────────

    /**
     * Write to the app's configured PUBLIC-facing disk. WHICH disk that
     * actually is — local disk (storage/app/public) or R2 — is controlled
     * entirely by FILESYSTEM_DISK in .env, read here via
     * config('filesystems.default'). Never hardcode a disk name in this
     * method again: that's what silently broke the R2 <-> local switch
     * before (this method used to call Storage::disk('s3') as a literal
     * string, which ignored FILESYSTEM_DISK entirely).
     *
     * Returns the DB-storable value — the file's full public URL via
     * Storage::url(). Callers must persist this return value verbatim;
     * do not re-derive a path from $diskPath yourself, or the stored
     * value won't match what was actually written.
     *
     * Note: files uploaded under a PREVIOUS FILESYSTEM_DISK setting keep
     * whatever URL shape that disk produced (local "storage/..." vs a
     * full R2 URL) — this method only controls what NEW uploads look
     * like. resolveFileUrl()/ImageCacheService on the frontend already
     * handles both shapes.
     */
    protected function storePublic(string $diskPath, string $binary): string
    {
        $disk = config('filesystems.default');
        Storage::disk($disk)->put($diskPath, $binary, 'public');
        return Storage::disk($disk)->url($diskPath);
    }

    /**
     * Write to private (local) disk — NOT web-accessible.
     * Returns the DB-storable path ("private/...").
     *
     * Intentionally still local, not R2: nothing currently calls this
     * (see AuthController::register()'s TODO — ID proofs are on the
     * public disk "for now"). Move this to R2 only once a signed/
     * presigned retrieval endpoint exists for private files; a public
     * R2 URL for a private document would defeat the point of this
     * method.
     */
    protected function storePrivate(string $diskPath, string $binary): string
    {
        Storage::disk('local')->put($diskPath, $binary);
        return 'private/' . $diskPath;
    }

    // ── Compound helpers ─────────────────────────────────────────────────────

    /**
     * Full pipeline for a single file → public disk.
     * decode → size-check → MIME-check → store
     * Returns DB path string, or null on any failure.
     */
    protected function processAndStorePublic(
        string $type,
        string $folder,
        string $category,
        string $data,
        int    $userId
    ): string|null {
        $binary = $this->decodeBase64($data);
        if ($binary === false)                      return null;
        if (!$this->checkSize($binary, $category))  return null;
        $mime = $this->detectMime($binary);
        if ($mime === null)                         return null;
        $diskPath = rtrim($folder, '/') . '/' . $this->makeFilename($type, $userId, $this->mimeToExtension($mime));
        return $this->storePublic($diskPath, $binary);
    }

    /**
     * Full pipeline for a single file → private disk.
     * Used for verification ID proofs.
     */
    protected function processAndStorePrivate(
        string $type,
        string $folder,
        string $category,
        string $data,
        int    $userId
    ): string|null {
        $binary = $this->decodeBase64($data);
        if ($binary === false)                      return null;
        if (!$this->checkSize($binary, $category))  return null;
        $mime = $this->detectMime($binary);
        if ($mime === null)                         return null;
        $diskPath = rtrim($folder, '/') . '/' . $this->makeFilename($type, $userId, $this->mimeToExtension($mime));
        return $this->storePrivate($diskPath, $binary);
    }

    /**
     * Process up to 2 proof files for SOS or hazard reports.
     * Silently skips files that fail any check.
     * Returns JSON-encoded array of DB paths.
     */
    protected function processProofFiles(array $files, int $userId, string $type): string
    {
        $paths = [];
        foreach (array_slice($files, 0, 2) as $raw) {
            if (!$raw || !is_string($raw)) continue;
            $path = $this->processAndStorePublic(
                $type, "reports/{$type}/{$userId}", 'proof', $raw, $userId
            );
            if ($path !== null) $paths[] = $path;
        }
        return json_encode($paths);
    }

    /**
     * Decode the JSON-encoded proof_files column on a fetched record into a
     * PHP array, in place. Shared by any controller listing emergency or
     * hazard records (previously duplicated per-controller).
     */
    protected function decodeProofFiles(object $record): object
    {
        if (isset($record->proof_files) && is_string($record->proof_files)) {
            $record->proof_files = json_decode($record->proof_files, true) ?? [];
        } elseif (!isset($record->proof_files)) {
            $record->proof_files = [];
        }
        return $record;
    }
}
