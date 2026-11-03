<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 12), 5), 100);
        $filters = [
            'code' => $this->normalizeFilterValue($request->query('code')),
            'project' => $this->normalizeFilterValue($request->query('project')),
            'client' => $this->normalizeFilterValue($request->query('client')),
            'business_unit' => $this->normalizeFilterValue($request->query('business_unit')),
            'status' => $this->normalizeFilterValue($request->query('status')),
            'coordinator' => $this->normalizeFilterValue($request->query('coordinator')),
        ];

        $query = Project::query()->withCount('paymentMilestones');
        $this->applyFilters($query, $filters);
        $projects = $query->orderBy('project_code')->paginate($perPage);

        return response()->json(
            [
                'data' => $projects->items(),
                'meta' => [
                    'current_page' => $projects->currentPage(),
                    'last_page' => $projects->lastPage(),
                    'per_page' => $projects->perPage(),
                    'total' => $projects->total(),
                    'from' => $projects->firstItem(),
                    'to' => $projects->lastItem(),
                ],
                'filterOptions' => [
                    'businessUnits' => $this->distinctValues('business_unit'),
                    'statusReasons' => $this->distinctValues('status_reason'),
                    'clients' => $this->distinctValues('client_name'),
                    'coordinators' => $this->distinctValues('project_coordinator'),
                ],
            ]
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

    private function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['code'], fn (Builder $builder, string $value) => $builder->where('project_code', 'like', "%{$value}%"))
            ->when($filters['project'], fn (Builder $builder, string $value) => $builder->where('project_name', 'like', "%{$value}%"))
            ->when($filters['client'], fn (Builder $builder, string $value) => $builder->where('client_name', 'like', "%{$value}%"))
            ->when($filters['business_unit'], fn (Builder $builder, string $value) => $builder->where('business_unit', 'like', "%{$value}%"))
            ->when($filters['status'], fn (Builder $builder, string $value) => $builder->where('status_reason', 'like', "%{$value}%"))
            ->when($filters['coordinator'], fn (Builder $builder, string $value) => $builder->where('project_coordinator', 'like', "%{$value}%"));
    }

    private function distinctValues(string $column): array
    {
        return Project::query()
            ->whereNotNull($column)
            ->select($column)
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeFilterValue(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return $normalized !== '' ? $normalized : null;
    }
}
