import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

export function Accordion({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Disclosure as="div" defaultOpen={defaultOpen}>
      <DisclosureButton className="group flex w-full items-center justify-between">
        <h3 className="font-medium text-black group-data-hover:text-black/80">
          {title}
        </h3>
        <ChevronDownIcon className="size-10 fill-black/60 group-data-hover:fill-black/50 group-data-open:rotate-180" />
      </DisclosureButton>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}
