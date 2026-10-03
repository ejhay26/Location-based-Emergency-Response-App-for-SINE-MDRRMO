<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** responders table: responder_id (PK), name, role, contact, status. No timestamp columns. */
class Responder extends Model
{
    protected $table = 'responders';
    protected $primaryKey = 'responder_id';
    public $timestamps = false;

    protected $fillable = ['name', 'role', 'contact', 'status'];
}
