/// <reference path="../utils.ts" />
/// <reference path="../dragAndDrop/dragAndDropService" />
/// <amd-dependency path="text!agList.html"/>

declare function require(name: string): any;

module awk.grid {

    //var template = require('./agList.html');
    var utils = Utils;
    var dragAndDropService = DragAndDropService.getInstance();
    var template =
        '<div class="ag-list-selection">'+
            '<div>'+
                '<div ag-repeat class="ag-list-item">'+
                '</div>'+
            '</div>'+
        '</div>';

    var NOT_DROP_TARGET = 0;
    var DROP_TARGET_ABOVE = 1;
    var DROP_TARGET_BELOW = -11;

    export class AgList {

        eGui: any;
        uniqueId: any;
        modelChangedListeners: any;
        itemSelectedListeners: any;
        beforeDropListeners: any;
        dragSources: any;
        emptyMessage: any;
        eFilterValueTemplate: any;
        eListParent: any;
        model: any;
        cellRenderer: any;

        constructor() {
            this.setupComponents();
            this.uniqueId = 'CheckboxSelection-' + Math.random();
            this.modelChangedListeners = [];
            this.itemSelectedListeners = [];
            this.beforeDropListeners = [];
            this.dragSources = [];
            this.setupAsDropTarget();
        }

        setEmptyMessage(emptyMessage: any) {
            this.emptyMessage = emptyMessage;
            this.refreshView();
        }

        getUniqueId() {
            return this.uniqueId;
        }

        addStyles(styles: any) {
            utils.addStylesToElement(this.eGui, styles);
        }

        addCssClass(cssClass: any) {
            utils.addCssClass(this.eGui, cssClass);
        }

        addDragSource(dragSource: any) {
            this.dragSources.push(dragSource);
        }

        addModelChangedListener(listener: any) {
            this.modelChangedListeners.push(listener);
        }

        addItemSelectedListener(listener: any) {
            this.itemSelectedListeners.push(listener);
        }

        addBeforeDropListener(listener: any) {
            this.beforeDropListeners.push(listener);
        }

        fireModelChanged() {
            for (var i = 0; i < this.modelChangedListeners.length; i++) {
                this.modelChangedListeners[i]();
            }
        }

        fireItemSelected(item: any) {
            for (var i = 0; i < this.itemSelectedListeners.length; i++) {
                this.itemSelectedListeners[i](item);
            }
        }

        fireBeforeDrop(item: any) {
            for (var i = 0; i < this.beforeDropListeners.length; i++) {
                this.beforeDropListeners[i](item);
            }
        }

        setupComponents() {

            this.eGui = utils.loadTemplate(template);
            this.eFilterValueTemplate = this.eGui.querySelector("[ag-repeat]");

            this.eListParent = this.eFilterValueTemplate.parentNode;
            utils.removeAllChildren(this.eListParent);
        }

        setModel(model: any) {
            this.model = model;
            this.refreshView();
        }

        getModel() {
            return this.model;
        }

        setCellRenderer(cellRenderer: any) {
            this.cellRenderer = cellRenderer;
        }

        refreshView() {
            utils.removeAllChildren(this.eListParent);

            if (this.model && this.model.length > 0) {
                this.insertRows();
            } else {
                this.insertBlankMessage();
            }
        }

        insertRows() {
            for (var i = 0; i < this.model.length; i++) {
                var item = this.model[i];
                //var text = this.getText(item);
                //var selected = this.isSelected(item);
                var eListItem = this.eFilterValueTemplate.cloneNode(true);

                if (this.cellRenderer) {
                    var params = {value: item};
                    utils.useRenderer(eListItem, this.cellRenderer, params);
                } else {
                    eListItem.innerHTML = item;
                }

                eListItem.addEventListener('click', this.fireItemSelected.bind(this, item));

                this.addDragAndDropToListItem(eListItem, item);
                this.eListParent.appendChild(eListItem);
            }
        }

        insertBlankMessage() {
            if (this.emptyMessage) {
                var eMessage = document.createElement('div');
                eMessage.style.color = 'grey';
                eMessage.style.padding = '4px';
                eMessage.style.textAlign = 'center';
                eMessage.innerHTML = this.emptyMessage;
                this.eListParent.appendChild(eMessage);
            }
        }

        setupAsDropTarget() {
            dragAndDropService.addDropTarget(this.eGui, {
                acceptDrag: this.externalAcceptDrag.bind(this),
                drop: this.externalDrop.bind(this),
                noDrop: this.externalNoDrop.bind(this)
            });
        }

        externalAcceptDrag(dragEvent: any) {
            var allowedSource = this.dragSources.indexOf(dragEvent.containerId) >= 0;
            if (!allowedSource) {
                return false;
            }
            var alreadyHaveCol = this.model.indexOf(dragEvent.data) >= 0;
            if (alreadyHaveCol) {
                return false;
            }
            this.eGui.style.backgroundColor = 'lightgreen';
            return true;
        }

        externalDrop(dragEvent: any) {
            var newListItem = dragEvent.data;
            this.fireBeforeDrop(newListItem);
            this.addItemToList(newListItem);
            this.eGui.style.backgroundColor = '';
        }

        externalNoDrop() {
            this.eGui.style.backgroundColor = '';
        }

        addItemToList(newItem: any) {
            this.model.push(newItem);
            this.refreshView();
            this.fireModelChanged();
        }

        addDragAndDropToListItem(eListItem: any, item: any) {
            var that = this;
            dragAndDropService.addDragSource(eListItem, {
                getData: function () {
                    return item;
                },
                getContainerId: function () {
                    return that.uniqueId;
                }
            });
            dragAndDropService.addDropTarget(eListItem, {
                acceptDrag: function (dragItem: any) {
                    return that.internalAcceptDrag(item, dragItem, eListItem);
                },
                drop: function (dragItem: any) {
                    that.internalDrop(item, dragItem.data);
                },
                noDrop: function () {
                    that.internalNoDrop(eListItem);
                }
            });
        }

        internalAcceptDrag(targetColumn: any, dragItem: any, eListItem: any) {
            var result = dragItem.data !== targetColumn && dragItem.containerId === this.uniqueId;
            if (result) {
                if (this.dragAfterThisItem(targetColumn, dragItem.data)) {
                    this.setDropCssClasses(eListItem, DROP_TARGET_ABOVE);
                } else {
                    this.setDropCssClasses(eListItem, DROP_TARGET_BELOW);
                }
            }
            return result;
        }

        internalDrop(targetColumn: any, draggedColumn: any) {
            var oldIndex = this.model.indexOf(draggedColumn);
            var newIndex = this.model.indexOf(targetColumn);

            this.model.splice(oldIndex, 1);
            this.model.splice(newIndex, 0, draggedColumn);

            this.refreshView();
            this.fireModelChanged();
        }

        internalNoDrop(eListItem: any) {
            this.setDropCssClasses(eListItem, NOT_DROP_TARGET);
        }

        dragAfterThisItem(targetColumn: any, draggedColumn: any) {
            return this.model.indexOf(targetColumn) < this.model.indexOf(draggedColumn);
        }

        setDropCssClasses(eListItem: any, state: any) {
            utils.addOrRemoveCssClass(eListItem, 'ag-not-drop-target', state === NOT_DROP_TARGET);
            utils.addOrRemoveCssClass(eListItem, 'ag-drop-target-above', state === DROP_TARGET_ABOVE);
            utils.addOrRemoveCssClass(eListItem, 'ag-drop-target-below', state === DROP_TARGET_BELOW);
        }

        getGui() {
            return this.eGui;
        }
    }

}

