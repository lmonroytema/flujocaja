<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;

class ProjectController extends Controller
{
    public function index()
    {
        return response()->json(
            Project::query()
                ->withCount('paymentMilestones')
                ->orderBy('project_code')
                ->get()
        );
    }

    public function show(Project $project)
    {
        return response()->json(
            $project->load([
                'paymentMilestones' => fn ($query) => $query->orderByDesc('estimated_payment_date'),
            ])
        );
    }
}
