"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function InteractionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Correctness</Label>
        <Select
          value={searchParams.get("correctness") ?? "all"}
          onValueChange={(v) => update("correctness", v)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="correct">Correct</SelectItem>
            <SelectItem value="correct_with_hint">Correct with hint</SelectItem>
            <SelectItem value="incorrect">Incorrect</SelectItem>
            <SelectItem value="unscored">Unscored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Template</Label>
        <Select
          value={searchParams.get("template") ?? "all"}
          onValueChange={(v) => update("template", v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="answer">Answer</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
            <SelectItem value="reveal">Reveal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          value={searchParams.get("from_dt") ?? ""}
          onChange={(e) => update("from_dt", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          value={searchParams.get("to_dt") ?? ""}
          onChange={(e) => update("to_dt", e.target.value)}
        />
      </div>

      {searchParams.size > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
          Clear filters
        </Button>
      )}
    </div>
  );
}
