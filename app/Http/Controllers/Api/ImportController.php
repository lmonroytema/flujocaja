<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ImportBatch;
use App\Services\Imports\PaymentMilestoneImportService;
use App\Services\Imports\ProjectImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImportController extends Controller
{
    public function __construct(
        private readonly ProjectImportService $projectImportService,
        private readonly PaymentMilestoneImportService $paymentMilestoneImportService,
    ) {
    }

    public function history()
    {
        return response()->json(
            ImportBatch::query()
                ->latest('imported_at')
                ->limit(20)
                ->get()
        );
    }

    public function importProjects(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls'],
        ]);

        $file = $request->file('file');
        $storedPath = $file->store('imports/projects', 'local');
        $batch = $this->projectImportService->import(
            Storage::disk('local')->path($storedPath),
            $file->getClientOriginalName(),
        );

        return response()->json($batch, 201);
    }

    public function importMilestones(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls'],
        ]);

        $file = $request->file('file');
        $storedPath = $file->store('imports/milestones', 'local');
        $batch = $this->paymentMilestoneImportService->import(
            Storage::disk('local')->path($storedPath),
            $file->getClientOriginalName(),
        );

        return response()->json($batch, 201);
    }
}
