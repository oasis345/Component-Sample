import { DataViewService } from '@occam4/common';
import { ContainerViewModel, isString, registry } from '@occam4/common';

const { modelService, callProp } = registry;

export class ContainerService<T extends ContainerViewModel> extends DataViewService<T> {
  constructor(props: any, childrenRef: any) {
    super(props);
    this.childrenRef = childrenRef;
  }

  type = 'ContainerView';

  childrenRef?: any[];

  get children() {
    const children = callProp<any[]>(this.model, 'children', { viewService: this });

    return children?.map((child) => (isString(child) ? modelService.getView(child) : child));
  }
}
